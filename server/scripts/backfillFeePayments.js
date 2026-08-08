// Seeds the FeePayment receipt ledger from challans that were paid before it existed.
//
// WHY
// The accounts ledger reports income as cash received in a month. From now on every
// payment writes its own dated receipt (see controllers/feeController.js), but
// challans settled before that change have only a running `amountPaid` total and a
// single `paymentDate`. Without a backfill the ledger would show months of school
// history as zero income.
//
// WHAT IT DOES
// For every challan with money against it and no receipts yet, writes ONE receipt
// for the full `amountPaid`, dated from the challan's own `paymentDate` (falling
// back to `updatedAt`, then `issueDate`). The row is flagged `isBackfill: true`.
//
// PRECISION, HONESTLY
// A challan part-paid in August and cleared in October has one date on it, so its
// whole amount lands on that one date. That is the best the old data supports; the
// flag is there so reports can say "includes historical figures" rather than imply
// a precision that was never recorded.
//
// SAFETY
// INSERT-ONLY. No FeeRecord is read for anything but its own values and none is
// ever modified. Idempotent: a challan that already has receipts is skipped, so
// re-running adds nothing.
//
// Run:  node scripts/backfillFeePayments.js          (report only, changes nothing)
//       node scripts/backfillFeePayments.js --apply  (write the receipts)

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../utils/connectDB');
const FeeRecord = require('../models/FeeRecord');
const FeePayment = require('../models/FeePayment');

const APPLY = process.argv.includes('--apply');
const BATCH = 500;

const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

const run = async () => {
  await connectDB();

  console.log(APPLY ? '\nBACKFILL — writing receipts\n' : '\nBACKFILL — dry run, nothing will be written\n');

  // Only challans that actually took money. A zero-paid challan has no receipt to
  // write, and `isDeleted` ones are out of the books entirely.
  const filter = { isDeleted: false, amountPaid: { $gt: 0 } };

  const total = await FeeRecord.countDocuments(filter);
  console.log(`${total} challan(s) with payments recorded.`);

  if (total === 0) {
    await mongoose.connection.close();
    process.exit(0);
  }

  // Which challans already have receipts — either from the live path or from a
  // previous run of this script. This is what makes re-running safe.
  const alreadyLedgered = new Set(
    (await FeePayment.distinct('feeRecord', { isDeleted: false })).map(String)
  );

  const cursor = FeeRecord.find(filter)
    .select('_id student campus academicSession amountPaid annualPaid discount paymentMethod paymentDate issueDate updatedAt challanNo')
    .lean()
    .cursor();

  let written = 0;
  let skipped = 0;
  let sumWritten = 0;
  let noDate = 0;
  let buffer = [];

  const flush = async () => {
    if (!APPLY || buffer.length === 0) { buffer = []; return; }
    await FeePayment.insertMany(buffer, { ordered: false });
    buffer = [];
  };

  for (let fee = await cursor.next(); fee != null; fee = await cursor.next()) {
    if (alreadyLedgered.has(String(fee._id))) { skipped++; continue; }

    // A challan with no payment date at all falls back to when it was last touched,
    // then to its issue date — so a receipt always has a month to belong to.
    const receivedOn = fee.paymentDate || fee.updatedAt || fee.issueDate || new Date();
    if (!fee.paymentDate) noDate++;

    const amount = Number(fee.amountPaid) || 0;
    // Cap the annual share at what was actually paid: `annualPaid` is an earmark
    // and on a legacy record it can exceed the money received.
    const annualPortion = Math.min(Math.max(Number(fee.annualPaid) || 0, 0), amount);

    buffer.push({
      feeRecord: fee._id,
      student: fee.student,
      campus: fee.campus,
      academicSession: fee.academicSession,
      amount,
      annualPortion,
      monthlyPortion: amount - annualPortion,
      discountApplied: Number(fee.discount) || 0,
      method: fee.paymentMethod || 'Cash',
      receivedOn,
      remarks: `Backfilled from challan ${fee.challanNo || fee._id}`,
      isBackfill: true,
    });

    written++;
    sumWritten += amount;

    if (buffer.length >= BATCH) await flush();
  }

  await flush();

  console.log(`\n  ${skipped} challan(s) already had receipts — skipped.`);
  console.log(`  ${written} receipt(s) ${APPLY ? 'written' : 'would be written'}, totalling ${fmt(sumWritten)}.`);
  if (noDate > 0) {
    console.log(`  ${noDate} of those had no paymentDate and were dated from their last update instead.`);
  }
  if (!APPLY && written > 0) console.log('\nRe-run with --apply to write these receipts.');

  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('Backfill failed:', err);
  try { await mongoose.connection.close(); } catch (_) {}
  process.exit(1);
});
