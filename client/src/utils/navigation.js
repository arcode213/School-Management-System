import {
  LayoutDashboard, Users, UserCog, DollarSign, FileText, BarChart2,
  Settings, Wallet, ArrowUpNarrowWide, ScrollText,
} from 'lucide-react';

/**
 * The sidebar, and the order the app falls back through when deciding where to
 * send someone.
 *
 * Each entry names the permission module that governs it, so the nav and the
 * route guards can never drift apart: if an account cannot open a screen, the
 * link to it is not drawn either.
 *
 * Grouped so a twelve-item sidebar reads as three short lists instead of one long
 * scroll — the sections match how the office actually works (who is enrolled,
 * what money moved, how the system is configured).
 */
export const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/students', label: 'Students', icon: Users, module: 'students' },
      { to: '/employees', label: 'Employees', icon: UserCog, module: 'employees' },
      { to: '/promotions', label: 'Promotions', icon: ArrowUpNarrowWide, module: 'promotions' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/fees', label: 'Fee Management', icon: DollarSign, module: 'fees' },
      { to: '/challans', label: 'Challans', icon: FileText, module: 'challans' },
      { to: '/fee-structures', label: 'Fee Structures', icon: Wallet, module: 'feeStructures' },
      { to: '/expenses', label: 'Expenses', icon: Wallet, module: 'expenses' },
      { to: '/dues', label: 'Dues Report', icon: BarChart2, module: 'dues' },
      { to: '/reports', label: 'Reports', icon: BarChart2, module: 'reports' },
    ],
  },
  {
    label: 'Administration',
    items: [
      // Managing accounts is not a grantable permission — it is the Admin role's
      // alone, so this one item is keyed on the role instead of a module. The
      // audit trail is the same: anyone who could be granted it could be granted
      // sight of everyone else's activity.
      { to: '/users', label: 'Users', icon: Users, adminOnly: true },
      { to: '/logs', label: 'Activity Logs', icon: ScrollText, adminOnly: true },
      { to: '/settings', label: 'System Settings', icon: Settings, module: 'settings' },
    ],
  },
];

const isVisible = (item, user, can) =>
  item.adminOnly ? user?.role === 'Admin' : can(item.module, 'view');

/** The groups this account may actually see, empty groups dropped. */
export const visibleNavGroups = (user, can) =>
  NAV_GROUPS
    .map(g => ({ ...g, items: g.items.filter(i => isVisible(i, user, can)) }))
    .filter(g => g.items.length > 0);

/**
 * Where to send this account when it opens the app.
 *
 * Not everyone gets the dashboard: an account granted only fee collection would
 * otherwise land on a screen it is not allowed to load. This walks the nav in
 * order and returns the first screen the account can actually open.
 */
export const landingPathFor = (user, can) => {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (isVisible(item, user, can)) return item.to;
    }
  }
  return null;
};
