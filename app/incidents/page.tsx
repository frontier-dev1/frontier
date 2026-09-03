import Link from "next/link";
import { createClient } from "../../lib/supabase/server";
import type { Database } from "../../database.types";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";

type Incident =
  Database["public"]["Tables"]["incidents"]["Row"];

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI Incidents | Frontier",
  description:
    "Explore significant incidents involving artificial intelligence systems.",
};

export default async function IncidentsPage() {
  const supabase = await createClient();

  const {
    data: incidents,
    error,
  } = await supabase
    .from("incidents")
    .select("*")
    .order("occurred_at", {
      ascending: false,
      nullsFirst: false,
    })
    .order("reported_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "Failed to load incidents:",
      error
    );
  }

  const rows =
    (incidents ?? []) as Incident[];

  return (
    <main className="min-h-screen bg-[#050B18] text-white">
      <SiteHeader />

      {/* Hero */}

      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute left-1/2 top-0 h-[450px] w-[900px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-16 lg:px-8 lg:pb-20 lg:pt-20">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
              AI Incident Database
            </div>

            <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              AI incidents,
              <span className="text-blue-400">
                {" "}
                documented.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
              Explore significant cases of unexpected,
              unauthorized, deceptive, unsafe, and autonomous
              AI behavior.
            </p>
          </div>

          {/* Stats */}

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Documented incidents"
              value={rows.length}
            />

            <StatCard
              label="Organizations"
              value={
                new Set(
                  rows
                    .map(
                      (incident) =>
                        incident.company
                    )
                    .filter(Boolean)
                ).size
              }
            />

            <StatCard
              label="High / Critical"
              value={
                rows.filter(
                  (incident) =>
                    incident.severity ===
                      "High" ||
                    incident.severity ===
                      "Critical"
                ).length
              }
            />
          </div>
        </div>
      </section>

      {/* Incidents */}

      <section>
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
                Database
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Documented incidents
              </h2>
            </div>

            <p className="text-sm text-slate-500">
              {rows.length}{" "}
              {rows.length === 1
                ? "incident"
                : "incidents"}
            </p>
          </div>

          {error ? (
            <DatabaseError />
          ) : rows.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="mt-8 grid gap-5">
              {rows.map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function IncidentCard({
  incident,
}: {
  incident: Incident;
}) {
  const severity =
    incident.severity ?? "Unknown";

  const severityClass =
    severity === "Critical"
      ? "border-red-400/30 bg-red-400/10 text-red-300"
      : severity === "High"
      ? "border-orange-400/30 bg-orange-400/10 text-orange-300"
      : severity === "Moderate"
      ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-300"
      : severity === "Low"
      ? "border-blue-400/30 bg-blue-400/10 text-blue-300"
      : "border-white/10 bg-white/5 text-slate-400";

  return (
    <article className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-blue-400/30 hover:bg-white/[0.045] lg:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-bold ${severityClass}`}
            >
              {severity}
            </span>

            {incident.category && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-400">
                {incident.category}
              </span>
            )}
          </div>

          <h3 className="mt-4 text-xl font-bold tracking-tight text-white transition group-hover:text-blue-300">
            {incident.title}
          </h3>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
            {incident.company && (
              <span>
                {incident.company}
              </span>
            )}

            {incident.model && (
              <span>
                {incident.model}
              </span>
            )}

            {incident.occurred_at && (
              <span>
                {formatDate(
                  incident.occurred_at
                )}
              </span>
            )}
          </div>

          {incident.summary && (
            <p className="mt-5 max-w-4xl text-sm leading-7 text-slate-400">
              {incident.summary}
            </p>
          )}
        </div>

        <div className="shrink-0">
          <Link
            href={`/incidents/${incident.id}`}
            className="inline-flex rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-blue-400/30 hover:bg-blue-400/10 hover:text-white"
          >
            View incident →
          </Link>
        </div>
      </div>
    </article>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold text-white">
        {value}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-20 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
        —
      </div>

      <h3 className="mt-5 text-lg font-bold">
        No incidents published yet
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Frontier is currently building its public
        incident database. Check back soon.
      </p>
    </div>
  );
}

function DatabaseError() {
  return (
    <div className="mt-8 rounded-2xl border border-red-400/20 bg-red-400/5 px-6 py-12 text-center">
      <h3 className="text-lg font-bold text-red-300">
        Unable to load incidents
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        The incident database could not be reached.
        Please try again later.
      </p>
    </div>
  );
}

function formatDate(
  date: string
) {
  try {
    return new Date(
      date
    ).toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    );
  } catch {
    return date;
  }
}