import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-sm font-bold text-white">
            F
          </div>

          <div>
            <div className="text-lg font-bold tracking-tight">
              Frontier
            </div>

            <div className="text-xs text-slate-500">
              AI Incident Tracker
            </div>
          </div>
        </Link>

        <nav className="flex items-center gap-6 text-sm text-slate-500">
          <Link
            href="/"
            className="hover:text-slate-950"
          >
            Incidents
          </Link>
        </nav>

      </div>
    </header>
  );
}