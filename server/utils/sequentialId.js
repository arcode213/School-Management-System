// Sequential human-readable IDs like "SMS-2026-004" / "EMP-2026-012".
//
// These derive the next number from the MAX existing numeric suffix rather than
// a document count. countDocuments() drifts and produces DUPLICATE ids the
// moment any record is permanently removed (a hard delete leaves a gap the count
// no longer accounts for), which then trips the unique index and throws a 500.
// Reading the current maximum is immune to that.

// Returns the next integer in the sequence for a given id prefix.
const getNextSeqNumber = async (Model, field, prefix, session) => {
  const query = Model.aggregate([
    { $match: { [field]: { $regex: `^${prefix}-\\d+-\\d+$` } } },
    { $project: { seq: { $toInt: { $arrayElemAt: [{ $split: [`$${field}`, '-'] }, -1] } } } },
    { $sort: { seq: -1 } },
    { $limit: 1 },
  ]);
  if (session) query.session(session);
  const [top] = await query;
  return (top?.seq || 0) + 1;
};

// Formats a sequence number into a full id for the current year.
const formatSeqId = (prefix, num) =>
  `${prefix}-${new Date().getFullYear()}-${String(num).padStart(3, '0')}`;

// Convenience: next full id in one call (single-record creates).
const generateSequentialId = async (Model, field, prefix, session) =>
  formatSeqId(prefix, await getNextSeqNumber(Model, field, prefix, session));

module.exports = { getNextSeqNumber, formatSeqId, generateSequentialId };
