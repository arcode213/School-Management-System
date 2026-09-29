/**
 * The permission catalogue — what a user account can be granted.
 *
 * Access is a grid: every module (a screen or a body of data) crossed with the
 * actions it supports. `view` is read; `create` / `edit` / `delete` are write.
 * Only the Admin role edits this grid; everyone else simply gets what they were
 * given.
 *
 * The client mirrors this list in `client/src/utils/permissions.js` so the
 * checkbox editor and the button gating can be rendered without a round trip.
 * KEEP THE TWO IN SYNC — the server copy is the authority: it is what validates
 * incoming grids and what every route is actually checked against.
 */

const ACTIONS = ['view', 'create', 'edit', 'delete'];

const MODULES = [
  {
    key: 'dashboard', label: 'Dashboard', group: 'Overview', actions: ['view'],
    hint: 'Home screen totals, charts and recent payments',
  },
  {
    key: 'students', label: 'Students', group: 'People', actions: ACTIONS,
    hint: 'Student records, admissions and Excel import',
  },
  {
    key: 'employees', label: 'Employees', group: 'People', actions: ACTIONS,
    hint: 'Staff records and profiles',
  },
  {
    key: 'salaries', label: 'Salaries', group: 'People', actions: ['view', 'create', 'edit'],
    hint: 'Salary history and posting a salary payment',
  },
  {
    key: 'promotions', label: 'Promotions', group: 'People', actions: ['view', 'edit'],
    hint: 'Moving students up a class at session rollover',
  },
  {
    key: 'fees', label: 'Fee Management', group: 'Finance', actions: ACTIONS,
    hint: 'Challans, fee generation and recording payments',
  },
  {
    key: 'challans', label: 'Challans & Printing', group: 'Finance', actions: ['view', 'create'],
    hint: 'Challan list, print preview and individual challans',
  },
  {
    key: 'feeStructures', label: 'Fee Structures', group: 'Finance', actions: ACTIONS,
    hint: 'Per-class fee amounts and per-student overrides',
  },
  {
    key: 'expenses', label: 'Expenses', group: 'Finance', actions: ACTIONS,
    hint: 'School expense entries',
  },
  {
    key: 'dues', label: 'Dues Report', group: 'Finance', actions: ['view'],
    hint: 'Outstanding balances across all students',
  },
  {
    key: 'accounts', label: 'Accounts & Ledger', group: 'Finance', actions: ACTIONS,
    hint: 'Monthly ledger, expense categories, recurring bills, approvals and month closing',
  },
  {
    key: 'reports', label: 'Financial Reports', group: 'Finance', actions: ['view'],
    hint: 'Income, expense and collection summaries',
  },
  {
    key: 'settings', label: 'System Settings', group: 'Administration', actions: ACTIONS,
    hint: 'Campuses and academic sessions',
  },
];

const MODULE_KEYS = MODULES.map(m => m.key);
const MODULE_BY_KEY = Object.fromEntries(MODULES.map(m => [m.key, m]));

// User management is deliberately absent from the grid. Accounts, permissions and
// the campus/session scopes are the Admin role's alone — that is the whole point
// of having one main admin — so those routes stay on a hard role check.

const emptyGrid = () => {
  const grid = {};
  for (const m of MODULES) {
    grid[m.key] = {};
    for (const a of m.actions) grid[m.key][a] = false;
  }
  return grid;
};

const gridFrom = (granted) => {
  const grid = emptyGrid();
  for (const m of MODULES) {
    const allowed = granted === 'all' ? m.actions : (granted[m.key] || []);
    for (const a of m.actions) grid[m.key][a] = allowed.includes(a);
  }
  return grid;
};

/**
 * What each role could do before permissions existed.
 *
 * Accounts already in the live database have no `permissions` grid, and the school
 * is using them right now — so an account without a grid keeps exactly the access
 * its role always had rather than losing everything. These tables reproduce the
 * old per-route `authorize(...)` lists one for one.
 */
const ROLE_DEFAULTS = {
  Admin: 'all',
  Administrator: {
    dashboard: ['view'],
    students: ACTIONS,
    employees: ACTIONS,
    salaries: ['view', 'create', 'edit'],
    promotions: ['view', 'edit'],
    fees: ACTIONS,
    challans: ['view', 'create'],
    feeStructures: ACTIONS,
    expenses: ACTIONS,
    dues: ['view'],
    reports: ['view'],
    // A capability that did not exist when these accounts were created is granted
    // to nobody by default. Closing a month or approving a bill is not something
    // an existing Administrator should silently acquire because the software was
    // updated — the Admin ticks it for whoever actually does the books.
    accounts: [],
    settings: [],
  },
  Staff: {
    dashboard: ['view'],
    students: ['view', 'create', 'edit'],
    employees: ['view', 'create', 'edit'],
    salaries: [],
    promotions: [],
    fees: ['view', 'create', 'edit'],
    challans: ['view', 'create'],
    feeStructures: ['view', 'create', 'edit'],
    expenses: ['view', 'create', 'edit'],
    dues: [],
    reports: [],
    accounts: [],
    settings: [],
  },
};

const defaultPermissionsForRole = (role) => gridFrom(ROLE_DEFAULTS[role] || ROLE_DEFAULTS.Staff);

/**
 * Coerce whatever the admin's form posted into a clean grid: known modules only,
 * known actions only, booleans only.
 *
 * A write implies a read. Granting `edit` without `view` would produce an account
 * that can change records it is not allowed to open — the screen would be blocked
 * while the API accepted the write — so `view` is turned on alongside any write.
 */
const sanitizePermissions = (input) => {
  const grid = emptyGrid();
  if (!input || typeof input !== 'object') return grid;

  for (const m of MODULES) {
    const posted = input[m.key];
    if (!posted || typeof posted !== 'object') continue;
    let needsView = false;
    for (const a of m.actions) {
      const on = posted[a] === true || posted[a] === 'true';
      grid[m.key][a] = on;
      if (on && a !== 'view') needsView = true;
    }
    if (needsView && m.actions.includes('view')) grid[m.key].view = true;
  }
  return grid;
};

const isEmptyGrid = (grid) =>
  !grid || typeof grid !== 'object' ||
  (typeof grid.keys === 'function' ? grid.size === 0 : Object.keys(grid).length === 0);

const plain = (value) => (value instanceof Map ? Object.fromEntries(value) : value);

// Normalise a stored grid against the current catalogue, so a module added after
// the account was saved reads as "not granted" rather than undefined.
const normalizeGrid = (stored) => {
  const grid = emptyGrid();
  for (const m of MODULES) {
    const row = stored?.[m.key];
    if (!row) continue;
    for (const a of m.actions) grid[m.key][a] = row[a] === true;
  }
  return grid;
};

/**
 * Per-campus overrides: { <campusId>: <grid> }.
 *
 * An account working at two campuses does not necessarily do the same job at
 * both — it might run the office at the main campus and only collect fees at the
 * second. Each campus id present here carries its own grid; a campus that is
 * absent falls back to the account's default grid.
 */
const sanitizeCampusPermissions = (input, allowedCampusIds = null) => {
  const out = {};
  const source = plain(input);
  if (!source || typeof source !== 'object') return out;

  for (const [campusId, grid] of Object.entries(source)) {
    if (!/^[a-f\d]{24}$/i.test(campusId)) continue;
    // A leftover override for a campus the account no longer works at would sit
    // in the record waiting to surprise someone if that campus is re-added.
    if (allowedCampusIds && allowedCampusIds.length > 0 && !allowedCampusIds.includes(campusId)) continue;
    out[campusId] = sanitizePermissions(grid);
  }
  return out;
};

/** The account's default grid — what applies at any campus with no override. */
const basePermissions = (user) => {
  if (!user) return emptyGrid();
  if (user.role === 'Admin') return gridFrom('all');

  const stored = plain(user.permissions);
  if (user.permissions === undefined || user.permissions === null) {
    return defaultPermissionsForRole(user.role);
  }
  return normalizeGrid(stored);
};

/**
 * The grid a request should actually be judged against.
 *
 * Admin is unrestricted. Otherwise the answer depends on WHERE the request is
 * working: if this campus has its own grid, that is the whole answer for this
 * request — it is not merged with the default, so an override can take access
 * away as well as add it. Any campus without an override uses the default grid.
 */
const effectivePermissions = (user, campusId = null) => {
  if (!user) return emptyGrid();
  if (user.role === 'Admin') return gridFrom('all');

  const overrides = plain(user.campusPermissions);
  const forCampus = campusId ? overrides?.[campusId.toString()] : null;
  if (forCampus && typeof forCampus === 'object' && Object.keys(forCampus).length > 0) {
    return normalizeGrid(forCampus);
  }

  return basePermissions(user);
};

const hasPermission = (user, moduleKey, action = 'view', campusId = null) => {
  if (user && user.role === 'Admin') return true;
  const grid = effectivePermissions(user, campusId);
  return grid[moduleKey]?.[action] === true;
};

module.exports = {
  ACTIONS,
  MODULES,
  MODULE_KEYS,
  MODULE_BY_KEY,
  ROLE_DEFAULTS,
  emptyGrid,
  defaultPermissionsForRole,
  sanitizePermissions,
  sanitizeCampusPermissions,
  basePermissions,
  effectivePermissions,
  hasPermission,
};
