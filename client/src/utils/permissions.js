/**
 * The permission catalogue, client side.
 *
 * MIRRORS `server/config/permissions.js` — keep the two in sync. The server copy
 * is the authority: it validates what gets saved and every route is checked
 * against it. This copy exists so the interface can be drawn without waiting on a
 * round trip — the nav, the route guards and the action buttons all ask `can()`.
 *
 * Hiding a button is a courtesy, not the lock. The lock is the API.
 */

export const ACTIONS = ['view', 'create', 'edit', 'delete'];

export const ACTION_LABELS = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
};

export const ACTION_HINTS = {
  view: 'Read — open the screen and see the records',
  create: 'Add new records',
  edit: 'Change existing records',
  delete: 'Remove records',
};

export const MODULES = [
  { key: 'dashboard', label: 'Dashboard', group: 'Overview', actions: ['view'], hint: 'Home screen totals, charts and recent payments' },
  { key: 'students', label: 'Students', group: 'People', actions: ACTIONS, hint: 'Student records, admissions and Excel import' },
  { key: 'employees', label: 'Employees', group: 'People', actions: ACTIONS, hint: 'Staff records and profiles' },
  { key: 'salaries', label: 'Salaries', group: 'People', actions: ['view', 'create'], hint: 'Salary history and posting a salary payment' },
  { key: 'promotions', label: 'Promotions', group: 'People', actions: ['view', 'edit'], hint: 'Moving students up a class at session rollover' },
  { key: 'fees', label: 'Fee Management', group: 'Finance', actions: ACTIONS, hint: 'Challans, fee generation and recording payments' },
  { key: 'challans', label: 'Challans & Printing', group: 'Finance', actions: ['view', 'create'], hint: 'Challan list, print preview and individual challans' },
  { key: 'feeStructures', label: 'Fee Structures', group: 'Finance', actions: ACTIONS, hint: 'Per-class fee amounts and per-student overrides' },
  { key: 'expenses', label: 'Expenses', group: 'Finance', actions: ACTIONS, hint: 'School expense entries' },
  { key: 'dues', label: 'Dues Report', group: 'Finance', actions: ['view'], hint: 'Outstanding balances across all students' },
  { key: 'reports', label: 'Financial Reports', group: 'Finance', actions: ['view'], hint: 'Income, expense and collection summaries' },
  { key: 'settings', label: 'System Settings', group: 'Administration', actions: ACTIONS, hint: 'Campuses and academic sessions' },
];

export const MODULE_GROUPS = [...new Set(MODULES.map(m => m.group))];

export const modulesInGroup = (group) => MODULES.filter(m => m.group === group);

/**
 * The grid that applies at a given campus.
 *
 * Rights can differ per campus — the same person may run the office at one and
 * only collect fees at another. A campus with its own grid uses it outright; it
 * is not merged with the default, so an override can take access away as well as
 * add it. Any campus without one falls back to the default grid. Mirrors
 * `effectivePermissions` on the server.
 */
export const gridForCampus = (user, campusId = null) => {
  if (!user) return {};
  const override = campusId ? user.campusPermissions?.[campusId] : null;
  if (override && Object.keys(override).length > 0) return override;
  return user.permissions || {};
};

/** Does this account have this module/action at this campus? Admin is unrestricted. */
export const can = (user, moduleKey, action = 'view', campusId = null) => {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  return gridForCampus(user, campusId)[moduleKey]?.[action] === true;
};

/** Any grant at all on a module — used to decide whether a nav item shows. */
export const canAny = (user, moduleKey, campusId = null) => {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  const row = gridForCampus(user, campusId)[moduleKey];
  return !!row && Object.values(row).some(Boolean);
};

/** A blank grid with every action off — the starting point for a new account. */
export const emptyGrid = () => {
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
 * Starting points the admin can apply with one click, then adjust.
 * These match the historic role behaviour in `server/config/permissions.js`, so
 * "Office Staff" reproduces exactly what a Staff account could always do.
 */
export const PRESETS = [
  {
    key: 'full',
    label: 'Full Access',
    hint: 'Everything except managing user accounts',
    build: () => gridFrom('all'),
  },
  {
    key: 'manager',
    label: 'Branch Manager',
    hint: 'All day-to-day work plus reports and dues',
    build: () => gridFrom({
      dashboard: ['view'],
      students: ACTIONS,
      employees: ACTIONS,
      salaries: ['view', 'create'],
      promotions: ['view', 'edit'],
      fees: ACTIONS,
      challans: ['view', 'create'],
      feeStructures: ACTIONS,
      expenses: ACTIONS,
      dues: ['view'],
      reports: ['view'],
      settings: [],
    }),
  },
  {
    key: 'staff',
    label: 'Office Staff',
    hint: 'Add and edit records, collect fees, no deleting or reports',
    build: () => gridFrom({
      dashboard: ['view'],
      students: ['view', 'create', 'edit'],
      employees: ['view', 'create', 'edit'],
      fees: ['view', 'create', 'edit'],
      challans: ['view', 'create'],
      feeStructures: ['view', 'create', 'edit'],
      expenses: ['view', 'create', 'edit'],
    }),
  },
  {
    key: 'cashier',
    label: 'Fee Cashier',
    hint: 'Collect fees and print challans only',
    build: () => gridFrom({
      dashboard: ['view'],
      students: ['view'],
      fees: ['view', 'edit'],
      challans: ['view', 'create'],
    }),
  },
  {
    key: 'readonly',
    label: 'Read Only',
    hint: 'Can see everything, can change nothing',
    build: () => gridFrom(Object.fromEntries(MODULES.map(m => [m.key, m.actions.includes('view') ? ['view'] : []]))),
  },
  {
    key: 'none',
    label: 'Clear All',
    hint: 'Untick everything and start fresh',
    build: () => emptyGrid(),
  },
];

/** Short human summary for the users table, e.g. "Students, Fees +3 more". */
export const summarizeGrid = (user) => {
  if (user?.role === 'Admin') return 'Full access (Admin)';
  const granted = MODULES.filter(m => canAny(user, m.key));
  if (granted.length === 0) return 'No access granted';
  const names = granted.map(m => m.label);
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} +${names.length - 3} more`;
};

/** How many individual boxes are ticked, out of how many exist. */
export const countGrid = (grid) => {
  let on = 0, total = 0;
  for (const m of MODULES) {
    for (const a of m.actions) {
      total++;
      if (grid?.[m.key]?.[a]) on++;
    }
  }
  return { on, total };
};
