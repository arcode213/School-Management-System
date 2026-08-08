const RecurringExpense = require('../models/RecurringExpense');
const Expense = require('../models/Expense');
const ExpenseCategory = require('../models/ExpenseCategory');
const { isMonthClosed } = require('../utils/monthLock');
const {
  currentMonthKey, monthsBetween, partsOf, ledgerMonthOf, OFFSET_MINUTES,
} = require('../utils/ledgerMonth');

/**
 * Recurring bills, and the job that raises them.
 *
 * Vercel runs this API as serverless functions, so there is no long-lived process
 * for `node-cron` to live in — a timer registered at module scope only fires if a
 * request happens to keep that instance warm, and then unpredictably. Generation
 * is therefore driven two ways, both landing in the same idempotent function:
 * the accounts screen calls it on load, and a scheduled request may call it too.
 * Whichever runs first does the work; the other finds nothing to do.
 *
 * The safety net is not the `lastGeneratedMonth` bookkeeping below — that is only
 * a fast skip. It is the unique index on (recurringSource, recurringMonth) in the
 * Expense schema, which makes a duplicate physically impossible even if both
 * triggers fire at the same instant.
 */

/** The UTC instant for `dayOfMonth` at 09:00 Karachi time in the given month. */
const dateForMonth = (monthKey, dayOfMonth) => {
  const parts = partsOf(monthKey);
  if (!parts) return null;
  // Mid-morning local time, so the row can never drift into an adjacent month
  // however the reader's clock is set.
  return new Date(
    Date.UTC(parts.year, parts.month - 1, dayOfMonth, 9, 0, 0) - OFFSET_MINUTES * 60 * 1000
  );
};

/**
 * Raises any missing rows for a campus, up to and including the current month.
 *
 * Returns what it did rather than throwing on partial failure: one template with a
 * problem must not stop the others from being raised.
 */
const generateDueRecurring = async ({ campus, academicSession, userId, upTo = null }) => {
  if (!campus || !academicSession) return { created: 0, skipped: 0, details: [] };

  const target = upTo || currentMonthKey();
  const templates = await RecurringExpense.find({
    campus,
    isActive: true,
    isDeleted: false,
  }).lean();

  let created = 0;
  let skipped = 0;
  const details = [];

  for (const tpl of templates) {
    // Never before the template starts, never after it ends.
    const from = tpl.lastGeneratedMonth
      ? monthsBetween(tpl.lastGeneratedMonth, target).slice(1)[0] || null
      : tpl.startMonth;
    if (!from) { skipped++; continue; }

    const last = tpl.endMonth && tpl.endMonth < target ? tpl.endMonth : target;
    const months = monthsBetween(from < tpl.startMonth ? tpl.startMonth : from, last);

    let latest = tpl.lastGeneratedMonth;

    for (const monthKey of months) {
      // A closed month is settled. Raising a new bill into it would change a
      // finalised total, so it is skipped rather than forced.
      if (await isMonthClosed(campus, monthKey)) {
        skipped++;
        details.push({ template: tpl.title, month: monthKey, result: 'skipped-month-closed' });
        continue;
      }

      try {
        await Expense.create({
          campus,
          academicSession,
          title: tpl.title,
          type: 'Expense',
          category: (await ExpenseCategory.findById(tpl.categoryRef).select('legacyKey').lean())?.legacyKey || 'Other',
          categoryRef: tpl.categoryRef,
          subCategory: tpl.subCategory,
          amount: tpl.amount,
          date: dateForMonth(monthKey, tpl.dayOfMonth || 1),
          description: tpl.description,
          paymentMethod: tpl.paymentMethod,
          paidTo: tpl.paidTo,
          // Raised, not paid. The admin confirms it once the bill is settled, and
          // only then does it count against the month.
          status: 'Pending',
          recurringSource: tpl._id,
          recurringMonth: monthKey,
          recordedBy: userId,
        });
        created++;
        latest = monthKey;
        details.push({ template: tpl.title, month: monthKey, result: 'created' });
      } catch (err) {
        if (err.code === 11000) {
          // Already raised — by an earlier run, or by a concurrent one. This is
          // the index doing its job, not a failure.
          skipped++;
          latest = monthKey;
          details.push({ template: tpl.title, month: monthKey, result: 'already-exists' });
        } else {
          details.push({ template: tpl.title, month: monthKey, result: `failed: ${err.message}` });
        }
      }
    }

    if (latest && latest !== tpl.lastGeneratedMonth) {
      await RecurringExpense.updateOne({ _id: tpl._id }, { $set: { lastGeneratedMonth: latest } });
    }
  }

  return { created, skipped, details };
};

// @desc    List recurring templates for the active campus
// @route   GET /api/recurring-expenses
const getRecurring = async (req, res) => {
  try {
    const { currentCampus } = req;
    if (!currentCampus) return res.status(400).json({ message: 'An active campus is required' });

    const query = { campus: currentCampus, isDeleted: false };
    if (req.query.includeInactive !== 'true') query.isActive = true;

    const templates = await RecurringExpense.find(query)
      .populate('categoryRef', 'name')
      .sort({ isActive: -1, title: 1 })
      .lean();

    res.json(templates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Create a recurring template
// @route   POST /api/recurring-expenses
const createRecurring = async (req, res) => {
  try {
    const { currentCampus } = req;
    if (!currentCampus) return res.status(400).json({ message: 'An active campus is required' });

    const template = await RecurringExpense.create({
      ...req.body,
      campus: currentCampus,
      startMonth: req.body.startMonth || currentMonthKey(),
      createdBy: req.user?._id,
    });

    res.status(201).json(template);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc    Update a recurring template
// @route   PUT /api/recurring-expenses/:id
const updateRecurring = async (req, res) => {
  try {
    const template = await RecurringExpense.findOne({
      _id: req.params.id, campus: req.currentCampus, isDeleted: false,
    });
    if (!template) return res.status(404).json({ message: 'Recurring bill not found' });

    const editable = [
      'title', 'categoryRef', 'subCategory', 'amount', 'paymentMethod',
      'paidTo', 'description', 'dayOfMonth', 'endMonth', 'isActive',
    ];
    for (const field of editable) {
      if (req.body[field] !== undefined) template[field] = req.body[field];
    }

    // `startMonth` is not editable: moving it backwards would raise bills into
    // months that have already been reported on, and possibly closed.
    template.updatedBy = req.user?._id;

    await template.save();
    res.json(template);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc    Stop a recurring template (soft delete)
// @route   DELETE /api/recurring-expenses/:id
const deleteRecurring = async (req, res) => {
  try {
    const template = await RecurringExpense.findOne({
      _id: req.params.id, campus: req.currentCampus, isDeleted: false,
    });
    if (!template) return res.status(404).json({ message: 'Recurring bill not found' });

    template.isDeleted = true;
    template.isActive = false;
    template.updatedBy = req.user?._id;
    await template.save();

    // Bills already raised from this template are left alone — they are real
    // liabilities the school still has to settle or reject.
    res.json({ message: 'Recurring bill stopped. Bills already raised from it are unchanged.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Raise any bills that are due (idempotent)
// @route   POST /api/recurring-expenses/generate
const runGeneration = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    if (!currentCampus || !currentSession) {
      return res.status(400).json({ message: 'Active campus and academic session context are required' });
    }

    const result = await generateDueRecurring({
      campus: currentCampus,
      academicSession: currentSession,
      userId: req.user?._id,
    });

    res.json({
      message: result.created > 0
        ? `${result.created} recurring bill${result.created > 1 ? 's' : ''} raised for confirmation`
        : 'No new recurring bills were due',
      ...result,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getRecurring,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  runGeneration,
  generateDueRecurring,
};
