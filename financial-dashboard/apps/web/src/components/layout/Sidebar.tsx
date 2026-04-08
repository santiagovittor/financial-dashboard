import { NavLink } from 'react-router';

const NAV_ITEMS: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/import', label: 'Import documents' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/debts', label: 'Debts' },
  { to: '/projection', label: 'Projection' },
  { to: '/history', label: 'History' },
  { to: '/settings', label: 'Settings' },
];

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white">
      <div className="flex h-14 items-center border-b border-gray-200 px-4">
        <span className="font-semibold text-gray-900">FinDash</span>
      </div>
      <nav className="p-3">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end === true}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
