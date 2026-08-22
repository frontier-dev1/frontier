import Header from "../app/components/Header";
import IncidentDashboard from "../app/components/IncidentDashboard";
import { getIncidents } from "../lib/incidents";

export const dynamic = "force-dynamic";

export default async function Home() {
  let incidents;

  try {
    incidents = await getIncidents();
  } catch (error) {
    console.error("Failed to load incidents:", error);

    return (
      <div className="min-h-screen bg-[#07111f]">
        <Header />

        <main className="mx-auto max-w-7xl px-6 py-20">
          <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-8">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">
              System error
            </div>

            <h1 className="mt-3 text-2xl font-bold text-white">
              Unable to load incidents
            </h1>

            <p className="mt-2 text-sm leading-6 text-red-200/80">
              Frontier couldn't retrieve incident data from
              the database. Please try again shortly.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main>
        <IncidentDashboard
          incidents={incidents ?? []}
        />
      </main>

      <footer
        id="about"
        className="border-t border-slate-200 bg-white"
      >
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <div className="text-sm font-bold tracking-[0.12em] text-slate-950">
                FRONTIER
              </div>

              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                An independent database tracking significant
                incidents involving artificial intelligence
                systems.
              </p>
            </div>

            <p className="text-xs text-slate-400">
              AI Incident Intelligence
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}