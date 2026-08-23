import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{
    id: string;
  }>;
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

export default async function IncidentPage({
  params,
}: Props) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: incident,
    error,
  } = await supabase
    .from("incidents")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(
      "Unable to load incident:",
      error
    );

    notFound();
  }

  if (!incident) {
    notFound();
  }

  const date =
    incident.occurred_at ??
    incident.reported_at;

  return (
    <main className="min-h-screen bg-slate-950 text-white">

      {/* Navigation */}

      <header className="border-b border-white/10 bg-slate-950/95 backdrop-blur">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <Link
            href="/"
            className="text-xl font-bold tracking-tight"
          >
            FRONTIER
          </Link>

          <nav className="flex items-center gap-8 text-sm font-medium">

            <Link
              href="/incidents"
              className="text-slate-300 transition hover:text-white"
            >
              Incidents
            </Link>

            <Link
              href="/about"
              className="text-slate-300 transition hover:text-white"
            >
              About
            </Link>

          </nav>

        </div>

      </header>


      {/* Incident */}

      <article className="mx-auto max-w-4xl px-6 py-16 lg:py-24">

        {/* Back */}

        <Link
          href="/incidents"
          className="inline-flex items-center text-sm font-medium text-slate-400 transition hover:text-blue-400"
        >
          ← Back to incidents
        </Link>


        {/* Metadata */}

        <div className="mt-10 flex flex-wrap items-center gap-2">

          <span
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              severityStyles[
                incident.severity
              ] ??
              "border-slate-400/20 bg-slate-400/10 text-slate-300"
            }`}
          >
            {incident.severity}
          </span>

          {incident.category && (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400">
              {incident.category}
            </span>
          )}

        </div>


        {/* Title */}

        <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
          {incident.title}
        </h1>


        {/* Company / Model / Date */}

        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">

          <span className="font-medium text-slate-300">
            {incident.company}
          </span>

          {incident.model && (
            <span>
              Model: {incident.model}
            </span>
          )}

          {date && (
            <span>
              {new Date(
                date
              ).toLocaleDateString(
                "en-US",
                {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                }
              )}
            </span>
          )}

        </div>


        {/* Divider */}

        <div className="my-10 border-t border-white/10" />


        {/* Summary */}

        <section>

          <div className="text-xs font-bold tracking-[0.2em] text-blue-400">
            SUMMARY
          </div>

          <p className="mt-4 text-xl leading-8 text-slate-300">
            {incident.summary}
          </p>

        </section>


        {/* Description */}

        {incident.description && (
          <section className="mt-12">

            <div className="text-xs font-bold tracking-[0.2em] text-blue-400">
              WHAT HAPPENED
            </div>

            <div className="mt-5 whitespace-pre-line text-base leading-8 text-slate-400">
              {incident.description}
            </div>

          </section>
        )}


        {/* Source */}

        <section className="mt-12 rounded-2xl border border-white/10 bg-slate-900 p-6">

          <div className="text-xs font-bold tracking-[0.2em] text-slate-500">
            SOURCE
          </div>

          <div className="mt-3 text-sm font-semibold text-white">
            {incident.source_name}
          </div>

          {incident.source_url && (
            <a
              href={incident.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-semibold text-blue-400 transition hover:text-blue-300"
            >
              Read original source →
            </a>
          )}

        </section>


        {/* Footer CTA */}

        <div className="mt-12 border-t border-white/10 pt-8">

          <Link
            href="/incidents"
            className="text-sm font-semibold text-blue-400 transition hover:text-blue-300"
          >
            ← Explore all incidents
          </Link>

        </div>

      </article>


      {/* Footer */}

      <footer className="border-t border-white/10">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-8">

          <div className="text-sm font-bold tracking-tight">
            FRONTIER
          </div>

          <div className="flex gap-6 text-sm text-slate-500">

            <Link
              href="/incidents"
              className="transition hover:text-slate-300"
            >
              Incidents
            </Link>

            <Link
              href="/about"
              className="transition hover:text-slate-300"
            >
              About
            </Link>

          </div>

        </div>

      </footer>

    </main>
  );
}