// One-off repair for challans generated BEFORE the annual-fee carry-forward fix.
//
// THE BUG
// Any unpaid annual fee rolled onto the next challan as `previousAnnualDues`, so a
// September challan printed this session's own annual fee under "Previous Annual
// Fee". It should stay on the "Annual Fee" line until it is paid or the academic
// session ends.
//
// The generator now classifies it correctly, but challans already written keep the
// wrong split, and because each new challan inherits from the last, the mistake
// re-carries forever. This script reclassifies them in place.
//
// WHAT IT DOES
// For every open (not fully paid, not yet carried forward) challan, it walks the
// carry-forward chain that fed it and works out how much of its `previousAnnualDues`
// actually originated in its OWN academic session. That amount moves to `annualFee`
// and is recorded in `annualCarriedForward`. Totals never change — only which line
// the same money prints on — so no balance, payment, or status is touched.
//
// Annual fee charged in an earlier session, and anything from an opening balance,
// is left in `previousAnnualDues` where it belongs.
//
// Run:  node scripts/fixAnnualCarryForward.js          (report only, changes nothing)
//       node scripts/fixAnnualCarryForward.js --apply  (write the changes)

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('../utils/connectDB');
const FeeRecord = require('../models/FeeRecord');

dotenv.config({ path: path.join(__dirname, '../.env') });

const APPLY = process.argv.includes('--apply');

// A challan's unpaid annual fee, tolerating records written before the bucket split.
const annualOutstanding = (c) =>
  c.annualBalance === undefined || c.annualBalance === null ? 0 : c.annualBalance;

// How much of `challan`'s unpaid annual fee belongs to `sessionId` — i.e. was charged
// by a challan of that session rather than inherited from an earlier one.
//
// Annual payments settle the oldest dues first (the rule the controller uses), so
// `annualPaid` is taken off `previousAnnualDues` before it touches `annualFee`.
// Whatever `previousAnnualDues` still owes is then attributed to the challans that
// fed it, recursively.
//
// `seen` guards against a corrupt carry-forward cycle pointing a chain back at itself.
const ownSessionAnnual = async (challan, sessionId, seen = new Set()) => {
  const outstanding = annualOutstanding(challan);
  if (outstanding <= 0) return 0;

  const id = challan._id.toString();
  if (seen.has(id)) return 0;
  seen.add(id);

  // An opening balance states dues brought in at admission/import; none of it was
  // charged by this session.
  if (challan.isOpeningBalance) return 0;
  if (challan.academicSession.toString() !== sessionId) return 0;

  const inherited = Math.min(
    Math.max((challan.previousAnnualDues || 0) - (challan.annualPaid || 0), 0),
    outstanding
  );
  // This challan's own annual fee, after the oldest-first payment allocation.
  let own = outstanding - inherited;
  if (inherited <= 0) return own;

  // Trace what fed `previousAnnualDues`. A carried-forward challan is frozen, so its
  // stored annualBalance is exactly what it contributed.
  const ancestors = await FeeRecord.find({ carriedForwardTo: challan._id, isDeleted: false });
  if (ancestors.length === 0) return own; // nothing to trace — treat as genuinely previous

  // Payments already accounted for above reduced the inherited pool; distribute the
  // surviving pool over the ancestors in order, oldest first.
  const ordered = ancestors.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const contributed = ordered.reduce((sum, a) => sum + annualOutstanding(a), 0);
  let alreadySettled = Math.max(contributed - inherited, 0);

  for (const ancestor of ordered) {
    const gross = annualOutstanding(ancestor);
    if (gross <= 0) continue;

    // Skip the share of this ancestor that the payments above already cleared.
    const settled = Math.min(alreadySettled, gross);
    alreadySettled -= settled;
    const surviving = gross - settled;
    if (surviving <= 0) continue;

    const ancestorOwn = await ownSessionAnnual(ancestor, sessionId, seen);
    // The ancestor's same-session share, scaled to how much of it survived payment.
    own += gross > 0 ? (ancestorOwn * surviving) / gross : 0;
  }

  return Math.min(own, outstanding);
};

const run = async () => {
  await connectDB();
  console.log(`--- Annual carry-forward repair (${APPLY ? 'APPLY' : 'DRY RUN'}) ---`);

  // Only open challans matter: a fully paid or already-carried challan is history and
  // is never printed or re-billed again.
  const open = await FeeRecord.find({
    isDeleted: false,
    hasBeenCarriedForward: false,
    isOpeningBalance: { $ne: true },
    previousAnnualDues: { $gt: 0 },
  }).sort({ createdAt: 1 });

  console.log(`Examining ${open.length} open challan(s) with previous annual dues.`);

  let changed = 0;
  for (const challan of open) {
    const sessionId = challan.academicSession.toString();
    const own = Math.round(await ownSessionAnnual(challan, sessionId));

    // `own` counts this challan's existing annualFee too; only the part currently
    // sitting in previousAnnualDues needs to move.
    const outstanding = annualOutstanding(challan);
    const alreadyCurrent = Math.min(challan.annualFee || 0, outstanding);
    const toMove = Math.min(Math.max(own - alreadyCurrent, 0), challan.previousAnnualDues || 0);
    if (toMove <= 0) continue;

    const before = { annualFee: challan.annualFee, previousAnnualDues: challan.previousAnnualDues, total: challan.totalAmount };

    challan.annualFee = (challan.annualFee || 0) + toMove;
    challan.previousAnnualDues = (challan.previousAnnualDues || 0) - toMove;
    challan.annualCarriedForward = (challan.annualCarriedForward || 0) + toMove;

    console.log(
      `  ${challan.challanNo}  annualFee ${before.annualFee} -> ${challan.annualFee}, ` +
      `previousAnnualDues ${before.previousAnnualDues} -> ${challan.previousAnnualDues}`
    );

    if (APPLY) {
      await challan.save(); // pre-save recomputes the buckets; the total is unchanged
      if (challan.totalAmount !== before.total) {
        // Never expected — the money only moved between two lines of the same bucket.
        console.warn(`  !! ${challan.challanNo} total changed ${before.total} -> ${challan.totalAmount}`);
      }
    }
    changed++;
  }

  console.log(`\n${changed} challan(s) ${APPLY ? 'updated' : 'would be updated'}.`);
  if (!APPLY && changed > 0) console.log('Re-run with --apply to write these changes.');

  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('Repair failed:', err);
  try { await mongoose.connection.close(); } catch (_) {}
  process.exit(1);
});
