const ExpenseCategory = require('../models/ExpenseCategory');
const { DEFAULT_CATEGORIES } = require('../config/expenseCategories');

/**
 * Gives a campus its starting set of categories the first time it needs them.
 *
 * Seeding lazily rather than in a migration means a campus created next year gets
 * the same defaults without anyone remembering to run anything, and the school
 * that is already live gets them the first time it opens the accounts screen.
 *
 * Safe to call on every request: it is a bulk upsert keyed on the unique
 * (campus, nameKey) index, so a category the admin has since renamed or
 * deactivated is never resurrected, and two simultaneous requests cannot create
 * duplicates — the second simply matches the row the first wrote.
 */
const seedExpenseCategories = async (campusId, userId = null) => {
  if (!campusId) return { seeded: 0 };

  // Cheap guard on the common path: once a campus has any category, the defaults
  // have been dealt with and we do not touch it again.
  const existing = await ExpenseCategory.countDocuments({ campus: campusId });
  if (existing > 0) return { seeded: 0 };

  const ops = DEFAULT_CATEGORIES.map((c) => {
    const nameKey = c.name.trim().toLowerCase();
    return {
      updateOne: {
        filter: { campus: campusId, nameKey },
        update: {
          $setOnInsert: {
            campus: campusId,
            name: c.name,
            nameKey,
            type: c.type,
            legacyKey: c.legacyKey || null,
            suggested: c.suggested || [],
            isDefault: true,
            isSystem: Boolean(c.isSystem),
            isActive: true,
            isDeleted: false,
            createdBy: userId,
          },
        },
        upsert: true,
      },
    };
  });

  try {
    const result = await ExpenseCategory.bulkWrite(ops, { ordered: false });
    return { seeded: result.upsertedCount || 0 };
  } catch (err) {
    // A duplicate-key here means another request seeded the same campus at the
    // same moment — the desired end state, so it is not an error.
    if (err.code === 11000) return { seeded: 0 };
    throw err;
  }
};

/**
 * Resolves the category for an expense that predates `categoryRef`.
 *
 * Existing rows carry only the old `category` string. Rather than rewrite them,
 * reads map that string onto whichever seeded category claimed it as its
 * `legacyKey`. Returns a lookup of legacyKey → category document.
 */
const legacyCategoryMap = async (campusId) => {
  const rows = await ExpenseCategory.find({
    campus: campusId,
    legacyKey: { $ne: null },
    isDeleted: false,
  }).select('name legacyKey type').lean();

  return Object.fromEntries(rows.map((r) => [r.legacyKey, r]));
};

module.exports = { seedExpenseCategories, legacyCategoryMap };
