import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export function RequireAuth() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'unauthenticated'>('loading');

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/auth/me`, { credentials: 'include' })
      .then((res) => {
        setStatus(res.ok ? 'ok' : 'unauthenticated');
      })
      .catch(() => setStatus('unauthenticated'));
  }, []);

  if (status === 'loading') return null;
  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  return <Outlet />;
}
