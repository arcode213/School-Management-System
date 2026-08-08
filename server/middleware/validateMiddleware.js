const { z } = require('zod');
const { MONTH_KEY_RE } = require('../utils/ledgerMonth');

/**
 * Request validation for the accounts module.
 *
 * The rest of the system validates by hand inside each controller, which is fine
 * for a handful of fields but not for money: the rules here ("never negative",
 * "never dated in the future", "never inside a closed month") have to hold on
 * every single write or the ledger stops reconciling, and a rule enforced in
 * eleven controllers is a rule missing from the twelfth.
 *
 * Failures answer in the shape the client already handles — `{ message }`, read
 * verbatim by the toast — with the field list attached for form highlighting.
 */
const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      field: i.path.join('.') || source,
      message: i.message,
    }));
    return res.status(400).json({
      // The first problem, phrased for a human, since that is what gets shown.
      message: issues[0].field === source
        ? issues[0].message
        : `${issues[0].field}: ${issues[0].message}`,
      errors: issues,
    });
  }

  // Parsed output, so downstream code gets coerced numbers and trimmed strings
  // rather than whatever the client happened to send.
  req[source] = result.data;
  next();
};

// ─── Shared field rules ──────────────────────────────────────────────────────

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'must be a valid id');

/**
 * Money. Coerced because HTML forms send strings, and rounded to 2 decimals
 * because floating-point rupees otherwise accumulate a drift that shows up as a
 * ledger that is off by a fraction of a paisa and never balances.
 */
const money = (label = 'Amount') =>
  z.coerce
    .number({ message: `${label} must be a number` })
    .finite(`${label} must be a number`)
    .min(0, `${label} cannot be negative`)
    .transform((n) => Math.round(n * 100) / 100);

const positiveMoney = (label = 'Amount') =>
  money(label).refine((n) => n > 0, { message: `${label} must be greater than zero` });

/**
 * A date that is not in the future.
 *
 * "Future" is judged with a day of slack rather than to the second: the client
 * sends a browser-local timestamp, so a cashier in Karachi recording a payment at
 * 11pm would otherwise be refused for being "in the future" of the server's UTC
 * clock. A whole day covers every timezone the school could plausibly be in.
 */
const pastOrToday = (label = 'Date') =>
  z.coerce
    .date({ message: `${label} is not a valid date` })
    .refine((d) => d.getTime() <= Date.now() + 24 * 60 * 60 * 1000, {
      message: `${label} cannot be in the future`,
    });

/** A date that may be in the future — a due date, a recovery month. */
const anyDate = (label = 'Date') =>
  z.coerce.date({ message: `${label} is not a valid date` });

const monthKey = (label = 'Month') =>
  z.string().regex(MONTH_KEY_RE, `${label} must look like 2026-08`);

const PAYMENT_METHODS = ['Cash', 'Bank', 'Cheque', 'Online'];
const SALARY_METHODS = ['Cash', 'Bank Transfer', 'Cheque'];

const trimmed = (max = 500) => z.string().trim().max(max, `must be under ${max} characters`);

module.exports = {
  validate,
  z,
  objectId,
  money,
  positiveMoney,
  pastOrToday,
  anyDate,
  monthKey,
  trimmed,
  PAYMENT_METHODS,
  SALARY_METHODS,
};
