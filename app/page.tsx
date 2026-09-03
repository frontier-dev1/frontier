import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "./components/SiteHeader";
import { SiteFooter } from "./components/SiteFooter";

export const dynamic = "force-dynamic";

type Incident = {
  id: string;
  title: string;
  company: string;
  model: string | null;
  severity: string;
  category: string | null;
  occurred_at: string | null;
  reported_at: string | null;
  summary: string;
};

const severityStyles: Record<string, string> = {
  Critical:
    "border-red-400/20 bg-red-400/10 text-red-300",

  High:
    "border-orange-400/20 bg-orange-400/10 text-orange-300",

  Moderate:
    "border-yellow-400/20 bg-yellow-400/10 text-yellow-300",

  Low:
    "border-blue-400/20 bg-blue-400/10 text-blue-300",
};

export default async function HomePage() {
  const supabase = await createClient();

  const { data: incidents } = await supabase
    .from("incidents")
    .select(
      "id, title, company, model, severity, category, occurred_at, reported_at, summary"
    )
    .order("occurred_at", {
      ascending: false,
      nullsFirst: false,
    })
    .limit(10);

  return (
    <main className="min-h-screen bg-[#050B18] text-white">

      <SiteHeader />

      {/* =====================================================
          HERO
      ====================================================== */}

      <section className="relative overflow-hidden">

        {/* Subtle background glow */}

        <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 py-24 lg:py-32">

          <div className="max-w-4xl">

            <div className="mb-6 inline-flex items-center rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
              AI Incident Intelligence
            </div>

            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Tracking when{" "}
              <span className="text-blue-400">
                AI goes wrong.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
              Frontier tracks significant incidents involving
              artificial intelligence systems — from unexpected
              behavior and unauthorized actions to security,
              safety, and alignment failures.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">

              <Link
                href="/incidents"
                className="rounded-xl bg-blue-500 px-6 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-blue-500/10 transition hover:bg-blue-400"
              >
                Explore incidents
              </Link>

              <Link
                href="/about"
                className="rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-center text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                About Frontier
              </Link>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          LATEST INCIDENTS
      ====================================================== */}

      <section className="border-y border-white/10 bg-white/[0.02]">

        <div className="mx-auto max-w-7xl px-6 py-20">

          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

            <div>

              <div className="text-xs font-bold tracking-[0.25em] text-blue-400">
                RECENTLY DOCUMENTED
              </div>

              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Latest incidents
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                The most recently documented AI incidents
                tracked by Frontier.
              </p>

            </div>

            <Link
              href="/incidents"
              className="shrink-0 text-sm font-semibold text-blue-400 transition hover:text-blue-300"
            >
              View all incidents →
            </Link>

          </div>


          {/* Incident list */}

          {incidents && incidents.length > 0 ? (

            <div className="mt-10 grid gap-4">

              {incidents.map((incident) => {

                const date =
                  incident.occurred_at ??
                  incident.reported_at;

                return (
                  <Link
                    key={incident.id}
                    href={`/incidents/${incident.id}`}
                    className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-blue-400/30 hover:bg-white/[0.045]"
                  >

                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                      {/* Main information */}

                      <div className="min-w-0">

                        <div className="flex flex-wrap items-center gap-2">

                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              severityStyles[
                                incident.severity
                              ] ??
                              "border-slate-400/20 bg-slate-400/10 text-slate-300"
                            }`}
                          >
                            {incident.severity}
                          </span>

                          {incident.category && (
                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-400">
                              {incident.category}
                            </span>
                          )}

                        </div>


                        <h3 className="mt-3 text-lg font-bold text-white transition group-hover:text-blue-300">
                          {incident.title}
                        </h3>


                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">

                          <span>
                            {incident.company}
                          </span>

                          {incident.model && (
                            <span>
                              {incident.model}
                            </span>
                          )}

                          {date && (
                            <span>
                              {new Date(
                                date
                              ).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )}
                            </span>
                          )}

                        </div>


                        {incident.summary && (
                          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                            {incident.summary}
                          </p>
                        )}

                      </div>


                      {/* Arrow */}

                      <div className="hidden shrink-0 text-xl text-slate-600 transition group-hover:translate-x-1 group-hover:text-blue-400 lg:block">
                        →
                      </div>

                    </div>

                  </Link>
                );
              })}

            </div>

          ) : (

            <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">

              <p className="text-sm text-slate-400">
                No incidents have been published yet.
              </p>

            </div>

          )}


          {/* Bottom CTA */}

          <div className="mt-8 flex justify-center">

            <Link
              href="/incidents"
              className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Explore the full incident database →
            </Link>

          </div>

        </div>

      </section>


      {/* =====================================================
          WHAT FRONTIER DOES
      ====================================================== */}

      <section>

        <div className="mx-auto max-w-7xl px-6 py-20">

          <div className="max-w-2xl">

            <div className="text-xs font-bold tracking-[0.25em] text-blue-400">
              WHY FRONTIER
            </div>

            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              A record of AI behavior in the real world.
            </h2>

            <p className="mt-5 text-base leading-7 text-slate-400">
              As AI systems become increasingly autonomous and
              capable, understanding how they behave inside and outside of
              controlled environments becomes increasingly
              important. Frontier provides a structured record
              of significant incidents so researchers,
              developers, and the public can understand what
              happened and why it matters.
            </p>

          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">

            <FeatureCard
              number="01"
              title="Discover"
              description="Continuously identify reports of significant AI behavior from across the web."
            />

            <FeatureCard
              number="02"
              title="Analyze"
              description="Use structured review and AI-assisted analysis to assess whether a report represents a meaningful incident."
            />

            <FeatureCard
              number="03"
              title="Document"
              description="Turn verified incidents into a searchable public record of AI behavior."
            />

          </div>

        </div>

      </section>


      <SiteFooter />

    </main>
  );
}


/* ============================================================
   FEATURE CARD
============================================================ */

function FeatureCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-blue-400/20 hover:bg-white/[0.05]">

      <div className="text-xs font-bold tracking-[0.2em] text-blue-400">
        {number}
      </div>

      <h3 className="mt-5 text-lg font-bold text-white">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-6 text-slate-400">
        {description}
      </p>

    </div>
  );
}