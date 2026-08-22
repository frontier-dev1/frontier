import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07111f]/90 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6">
        <Link
          href="/"
          className="group flex items-center gap-3"
        >
          <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-blue-500 text-sm font-black text-white shadow-lg shadow-blue-500/25">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-300/30 to-transparent" />
            <span className="relative">F</span>
          </div>

          <div>
            <div className="text-[15px] font-bold tracking-[0.08em] text-white">
              FRONTIER
            </div>

            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
              AI Incident Intelligence
            </div>
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            Incidents
          </Link>

          <a
            href="#about"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white sm:block"
          >
            About
          </a>
        </nav>
      </div>
    </header>
  );
}