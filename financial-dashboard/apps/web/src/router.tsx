import { createBrowserRouter } from 'react-router';
import { RequireAuth } from './components/RequireAuth.js';
import { AppShell } from './components/layout/AppShell.js';
import { Dashboard } from './pages/Dashboard.js';
import { Debts } from './pages/Debts.js';
import { Expenses } from './pages/Expenses.js';
import { History } from './pages/History.js';
import { Login } from './pages/Login.js';
import { Projection } from './pages/Projection.js';
import { Settings } from './pages/Settings.js';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'expenses', element: <Expenses /> },
          { path: 'debts', element: <Debts /> },
          { path: 'projection', element: <Projection /> },
          { path: 'history', element: <History /> },
          { path: 'settings', element: <Settings /> },
        ],
      },
    ],
  },
]);
