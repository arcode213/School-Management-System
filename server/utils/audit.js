const { MODULES } = require('../config/permissions');

/**
 * Turning an HTTP request into a readable audit entry.
 *
 * The point of this file is that nothing here lives in a controller. Logging
 * bolted onto twenty handlers is logging that is missing from the twenty-first
 * the day someone adds it — so the request itself is described from its route,
 * and the change is worked out by comparing the record before and after. Adding
 * a new endpoint under an existing resource is logged without anyone remembering
 * to log it.
 */

const OID = '([a-f\\d]{24})';

/**
 * What each route touches. `model` is the mongoose model name, used to read the
 * record before and after so the fields that moved can be worked out.
 */
const ROUTES = [
  // Auth — handled specially: never carries a body into the log.
  { re: /^\/api\/auth\/login\/?$/i, module: 'auth', entity: 'Session', auth: true },

  // Students
  { re: /^\/api\/students\/bulk\/?$/i, model: 'Student', module: 'students', entity: 'Student', action: 'bulk-create' },
  { re: /^\/api\/students\/promote\/?$/i, module: 'promotions', entity: 'Student', action: 'bulk-update', verb: 'Promoted students' },
  { re: new RegExp(`^/api/students/${OID}/?$`, 'i'), model: 'Student', module: 'students', entity: 'Student' },
  { re: /^\/api\/students\/?$/i, model: 'Student', module: 'students', entity: 'Student' },

  // Fees / challans
  { re: /^\/api\/fees\/bulk\/?$/i, model: 'FeeRecord', module: 'fees', entity: 'FeeRecord', action: 'bulk-create', verb: 'Generated monthly fee challans' },
  { re: new RegExp(`^/api/fees/${OID}/?$`, 'i'), model: 'FeeRecord', module: 'fees', entity: 'FeeRecord' },
  { re: /^\/api\/fees\/?$/i, model: 'FeeRecord', module: 'fees', entity: 'FeeRecord' },

  // Employees & salaries
  { re: /^\/api\/employees\/bulk\/?$/i, model: 'Employee', module: 'employees', entity: 'Employee', action: 'bulk-create' },
  { re: /^\/api\/employees\/salary\/?$/i, model: 'SalaryRecord', module: 'salaries', entity: 'SalaryRecord', verb: 'Posted a salary payment' },
  { re: new RegExp(`^/api/employees/${OID}/?$`, 'i'), model: 'Employee', module: 'employees', entity: 'Employee' },
  { re: /^\/api\/employees\/?$/i, model: 'Employee', module: 'employees', entity: 'Employee' },

  // Fee structures & overrides
  { re: /^\/api\/fee-structures\/rollover\/?$/i, module: 'feeStructures', entity: 'FeeStructure', action: 'bulk-create', verb: 'Rolled fee structures over to a new session' },
  { re: new RegExp(`^/api/fee-structures/overrides/${OID}/?$`, 'i'), model: 'StudentFeeOverride', module: 'feeStructures', entity: 'StudentFeeOverride' },
  { re: /^\/api\/fee-structures\/overrides\/?$/i, model: 'StudentFeeOverride', module: 'feeStructures', entity: 'StudentFeeOverride' },
  { re: /^\/api\/fee-structures\/?$/i, model: 'FeeStructure', module: 'feeStructures', entity: 'FeeStructure' },

  // Expenses
  { re: new RegExp(`^/api/expenses/${OID}/status/?$`, 'i'), model: 'Expense', module: 'accounts', entity: 'Expense', verb: 'Approved or rejected an expense' },
  { re: new RegExp(`^/api/expenses/${OID}/?$`, 'i'), model: 'Expense', module: 'expenses', entity: 'Expense' },
  { re: /^\/api\/expenses\/?$/i, model: 'Expense', module: 'expenses', entity: 'Expense' },

  // Accounts & finance.
  //
  // Registered here rather than in a controller because this table is what the
  // audit middleware matches on — a route missing from it is a route that logs
  // nothing at all, however consequential it is. Closing a month and paying a
  // salary are exactly the actions someone will later need to trace.
  { re: /^\/api\/accounts\/close-month\/?$/i, model: 'ClosedMonth', module: 'accounts', entity: 'ClosedMonth', action: 'create', verb: 'Closed an accounting month' },
  { re: /^\/api\/accounts\/reopen-month\/?$/i, model: 'ClosedMonth', module: 'accounts', entity: 'ClosedMonth', action: 'update', verb: 'Reopened a closed accounting month' },

  { re: /^\/api\/recurring-expenses\/generate\/?$/i, model: 'Expense', module: 'accounts', entity: 'Expense', action: 'bulk-create', verb: 'Raised recurring bills' },
  { re: new RegExp(`^/api/recurring-expenses/${OID}/?$`, 'i'), model: 'RecurringExpense', module: 'accounts', entity: 'RecurringExpense' },
  { re: /^\/api\/recurring-expenses\/?$/i, model: 'RecurringExpense', module: 'accounts', entity: 'RecurringExpense' },

  { re: new RegExp(`^/api/expense-categories/${OID}/?$`, 'i'), model: 'ExpenseCategory', module: 'accounts', entity: 'ExpenseCategory' },
  { re: /^\/api\/expense-categories\/?$/i, model: 'ExpenseCategory', module: 'accounts', entity: 'ExpenseCategory' },

  { re: /^\/api\/salaries\/pay\/?$/i, model: 'SalaryRecord', module: 'salaries', entity: 'SalaryRecord', action: 'create', verb: 'Paid a salary' },
  { re: new RegExp(`^/api/salaries/${OID}/?$`, 'i'), model: 'SalaryRecord', module: 'salaries', entity: 'SalaryRecord', action: 'edit', verb: 'Updated salary record' },
  { re: new RegExp(`^/api/salaries/advances/${OID}/?$`, 'i'), model: 'SalaryAdvance', module: 'accounts', entity: 'SalaryAdvance' },
  { re: /^\/api\/salaries\/advances\/?$/i, model: 'SalaryAdvance', module: 'accounts', entity: 'SalaryAdvance', verb: 'Gave a salary advance' },

  // System settings
  { re: /^\/api\/system\/reset-data\/?$/i, module: 'settings', entity: 'Data', action: 'reset-data', verb: 'Permanently deleted school data' },
  { re: new RegExp(`^/api/system/campuses/${OID}/?$`, 'i'), model: 'Campus', module: 'settings', entity: 'Campus' },
  { re: /^\/api\/system\/campuses\/?$/i, model: 'Campus', module: 'settings', entity: 'Campus' },
  { re: new RegExp(`^/api/system/sessions/${OID}/?$`, 'i'), model: 'AcademicSession', module: 'settings', entity: 'AcademicSession' },
  { re: /^\/api\/system\/sessions\/?$/i, model: 'AcademicSession', module: 'settings', entity: 'AcademicSession' },

  // User accounts
  { re: new RegExp(`^/api/users/${OID}/?$`, 'i'), model: 'User', module: 'users', entity: 'User' },
  { re: /^\/api\/users\/?$/i, model: 'User', module: 'users', entity: 'User' },
];

/** Match a request path to its descriptor, pulling out the record id if present. */
const describeRoute = (pathname) => {
  const clean = pathname.split('?')[0];
  for (const route of ROUTES) {
    const match = clean.match(route.re);
    if (match) return { ...route, entityId: match[1] || null };
  }
  return null;
};

const ACTION_BY_METHOD = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };

// --- readable naming --------------------------------------------------------

/** The one field that identifies a record to a person reading the log. */
const labelFor = (entity, doc) => {
  if (!doc) return '';
  switch (entity) {
    case 'Student': return [doc.fullName, doc.studentId].filter(Boolean).join(' · ');
    case 'Employee': return [doc.fullName, doc.employeeId].filter(Boolean).join(' · ');
    case 'FeeRecord': return doc.challanNo ? `Challan ${doc.challanNo}` : '';
    case 'SalaryRecord': return [doc.month, doc.year].filter(Boolean).join(' ');
    case 'Expense': return [doc.category, doc.description].filter(Boolean).join(' · ');
    case 'FeeStructure': return doc.className ? `Class ${doc.className}` : '';
    case 'StudentFeeOverride': return 'Fee override';
    case 'User': return [doc.name, doc.email].filter(Boolean).join(' · ');
    case 'Campus':
    case 'AcademicSession': return doc.name || '';
    default: return doc.name || doc.fullName || '';
  }
};

const ENTITY_LABELS = {
  Student: 'student', Employee: 'employee', FeeRecord: 'challan', SalaryRecord: 'salary record',
  Expense: 'transaction', FeeStructure: 'fee structure', StudentFeeOverride: 'fee override',
  User: 'user account', Campus: 'campus', AcademicSession: 'academic session', Session: 'session',
};

// Field names as the office would say them, not as the schema spells them.
const FIELD_LABELS = {
  fullName: 'Name', fatherName: "Father's name", studentId: 'Student ID', employeeId: 'Employee ID',
  className: 'Class', rollNumber: 'Roll number', phone: 'Phone', address: 'Address',
  amountPaid: 'Amount paid', annualPaid: 'Annual fee paid', discount: 'Discount', lateFine: 'Late fine',
  tuitionFee: 'Tuition fee', transportFee: 'Transport fee', miscFee: 'Misc fee', examFee: 'Exam fee',
  admissionFee: 'Admission fee', annualFee: 'Annual fee', previousDues: 'Previous dues',
  totalAmount: 'Total amount', balance: 'Balance', status: 'Status', paymentMethod: 'Payment method',
  paymentDate: 'Payment date', remarks: 'Remarks', challanNo: 'Challan no', feeMonth: 'Fee month',
  isFreeship: 'Freeship', isActive: 'Active', isDeleted: 'Deleted', role: 'Role', email: 'Email',
  name: 'Name', designation: 'Designation', department: 'Department', salary: 'Salary',
  amount: 'Amount', category: 'Category', type: 'Type', description: 'Description',
  permissions: 'Permissions', campusPermissions: 'Per-campus permissions',
  campusScope: 'Campus access', sessionScope: 'Session access', campus: 'Campus',
};

const humanize = (field) =>
  FIELD_LABELS[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();

// --- diffing ----------------------------------------------------------------

// Bookkeeping the reader does not care about, plus anything that must never be
// written to a log in any form.
const IGNORED = new Set(['_id', '__v', 'createdAt', 'updatedAt', 'password', 'id']);
const REDACTED = new Set(['password', 'token', 'newPassword']);

const normalize = (value) => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'object') {
    if (value._bsontype === 'ObjectID' || value._bsontype === 'ObjectId') return value.toString();
    if (typeof value.toHexString === 'function') return value.toHexString();
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (IGNORED.has(k)) continue;
      out[k] = normalize(v);
    }
    return out;
  }
  return value;
};

const same = (a, b) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));

const MODULE_LABEL = Object.fromEntries(MODULES.map(m => [m.key, m.label]));

/**
 * Permission grids diff badly as raw objects — the reader wants "gained the right
 * to delete students", not two pages of booleans. This reduces the two grids to
 * the boxes that actually moved.
 */
const describeGridDelta = (before, after) => {
  const granted = [], revoked = [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  for (const moduleKey of keys) {
    const b = before?.[moduleKey] || {};
    const a = after?.[moduleKey] || {};
    for (const action of new Set([...Object.keys(b), ...Object.keys(a)])) {
      if (!!b[action] === !!a[action]) continue;
      const label = `${MODULE_LABEL[moduleKey] || moduleKey} · ${action}`;
      (a[action] ? granted : revoked).push(label);
    }
  }

  const parts = [];
  if (granted.length) parts.push(`Granted: ${granted.join(', ')}`);
  if (revoked.length) parts.push(`Revoked: ${revoked.join(', ')}`);
  return parts.join(' — ') || 'No effective change';
};

const describeCampusGridDelta = (before, after) => {
  const parts = [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const campusId of keys) {
    const b = before?.[campusId], a = after?.[campusId];
    if (!b && a) parts.push(`Campus ${campusId}: custom access set`);
    else if (b && !a) parts.push(`Campus ${campusId}: back to default access`);
    else if (!same(b, a)) parts.push(`Campus ${campusId}: ${describeGridDelta(b, a)}`);
  }
  return parts.join(' | ') || 'No effective change';
};

/**
 * Which fields moved between two versions of a record.
 * Returns [] when nothing changed — a save that changed nothing is still logged,
 * but it says so rather than inventing a change.
 */
const diffDocs = (before, after) => {
  const b = normalize(before) || {};
  const a = normalize(after) || {};
  const changes = [];

  for (const field of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (IGNORED.has(field)) continue;
    if (same(b[field], a[field])) continue;

    if (field === 'permissions') {
      changes.push({ field, label: humanize(field), from: 'see summary', to: describeGridDelta(b[field], a[field]) });
    } else if (field === 'campusPermissions') {
      changes.push({ field, label: humanize(field), from: 'see summary', to: describeCampusGridDelta(b[field], a[field]) });
    } else {
      changes.push({
        field,
        label: humanize(field),
        from: REDACTED.has(field) ? '••••' : b[field] ?? null,
        to: REDACTED.has(field) ? '••••' : a[field] ?? null,
      });
    }
  }

  return changes;
};

/** Strip anything that must never be persisted, then keep the result small. */
const safeSnapshot = (doc) => {
  const clean = normalize(doc);
  if (!clean || typeof clean !== 'object') return undefined;
  for (const key of REDACTED) delete clean[key];
  return clean;
};

/** The sentence shown in the log's main column. */
const buildDescription = ({ route, action, entity, entityLabel, changes, denied, failed, summary }) => {
  const noun = ENTITY_LABELS[entity] || 'record';
  const named = entityLabel ? ` — ${entityLabel}` : '';

  if (denied) return `Blocked: not permitted to ${action} ${noun}${named}`;

  // An attempt that errored must not read like something that happened. "Added a
  // new transaction" against a request the server rejected would be a false
  // record — worse than no record, because it would be believed.
  if (failed) {
    const attempted = {
      create: 'add', update: 'update', delete: 'delete',
      'bulk-create': 'import', 'bulk-update': 'bulk update', 'reset-data': 'reset',
    }[action] || action;
    return `Failed attempt to ${attempted} ${noun}${named}`;
  }

  // Bulk operations already report themselves precisely ("34 students imported
  // successfully"). "Imported students in bulk" with no number is the kind of log
  // entry that raises the question it was written to answer, so prefer the
  // server's own count whenever there is one.
  if (summary && (action === 'bulk-create' || action === 'bulk-update' || action === 'reset-data')) {
    return summary;
  }

  if (route?.verb) return `${route.verb}${named}`;

  switch (action) {
    case 'create': return `Added a new ${noun}${named}`;
    case 'bulk-create': return `Imported ${noun}s in bulk${named}`;
    case 'bulk-update': return `Updated ${noun}s in bulk${named}`;
    case 'delete': return `Deleted ${noun}${named}`;
    case 'update': {
      if (!changes?.length) return `Saved ${noun}${named} with no changes`;
      const fields = changes.slice(0, 3).map(c => c.label).join(', ');
      const more = changes.length > 3 ? ` +${changes.length - 3} more` : '';
      return `Updated ${noun}${named}: ${fields}${more}`;
    }
    case 'login': return 'Signed in';
    case 'login-failed': return 'Failed sign-in attempt';
    case 'reset-data': return 'Permanently deleted school data';
    default: return `${action} ${noun}${named}`;
  }
};

module.exports = {
  ROUTES, describeRoute, ACTION_BY_METHOD,
  labelFor, humanize, ENTITY_LABELS, FIELD_LABELS,
  diffDocs, safeSnapshot, buildDescription, describeGridDelta, normalize,
};
