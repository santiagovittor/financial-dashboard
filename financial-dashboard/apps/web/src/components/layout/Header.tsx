export function Header() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div />
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Owner</span>
        <div className="size-8 rounded-full bg-gray-200" />
      </div>
    </header>
  );
}
