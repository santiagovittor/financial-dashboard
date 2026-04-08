export function Login() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold text-gray-900">Financial Dashboard</h1>
        <p className="mb-6 text-sm text-gray-500">Sign in to continue.</p>
        <a
          href={`${import.meta.env.VITE_API_URL ?? ''}/api/v1/auth/google`}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
          Sign in with Google
        </a>
      </div>
    </div>
  );
}
