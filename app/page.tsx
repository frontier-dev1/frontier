import Header from "../app/components/Header";
import IncidentDashboard from "../app/components/IncidentDashboard";
import { getIncidents } from "../lib/incidents";

export const dynamic = "force-dynamic";

export default async function Home() {
  let incidents;

try {
  incidents = await getIncidents();
} catch (error) {
  console.error(error);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="mx-auto max-w-7xl px-6 py-16">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
          <h1 className="text-xl font-bold text-red-900">
            Unable to load incidents
          </h1>

          <p className="mt-2 text-red-700">
            Frontier couldn't retrieve incident data.
          </p>
        </div>
      </main>
    </div>
  );


    return (
      <div className="min-h-screen bg-slate-50">
        <Header />

        <main className="mx-auto max-w-7xl px-6 py-16">

          <div className="rounded-2xl border border-red-200 bg-red-50 p-8">

            <h1 className="text-xl font-bold text-red-900">
              Unable to load incidents
            </h1>

            <p className="mt-2 text-red-700">
              Frontier couldn't retrieve incident data
              from the database.
            </p>

          </div>

        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">

      <Header />

      <main className="mx-auto max-w-7xl px-6 py-12">

        <IncidentDashboard
          incidents={incidents ?? []}
        />

      </main>

    </div>
  );
}