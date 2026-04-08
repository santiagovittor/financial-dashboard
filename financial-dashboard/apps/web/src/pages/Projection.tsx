export function Projection() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 mb-6 rounded-2xl bg-gray-100 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
          />
        </svg>
      </div>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Projection</h1>
      <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
        Spend projection and forecasting is coming soon.
      </p>
    </div>
  );
}
