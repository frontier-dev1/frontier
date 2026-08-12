import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import SeverityBadge from "../../components/SeverityBadge";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

function formatDate(date: string | null) {
  if (!date) {
    return "Unknown";
  }

  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function IncidentPage({
  params,
}: Props) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: incident, error } = await supabase
    .from("incidents")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  /*
   * If Supabase couldn't retrieve the incident,
   * show the normal Next.js 404 page.
   */
  if (error) {
    console.error(
      "Failed to load incident:",
      error
    );

    notFound();
  }

  if (!incident) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-4xl px-6 py-12">

        <Link
          href="/"
          className="text-sm font-medium text-slate-500 hover:text-slate-950"
        >
          ← Back to incidents
        </Link>

        <article className="mt-8">

          <SeverityBadge
            severity={incident.severity}
          />

          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            {incident.title}
          </h1>

          <p className="mt-4 text-lg text-slate-500">
            {incident.company} · {incident.model}
          </p>

          <div className="mt-8 grid gap-4 border-y border-slate-200 py-6 sm:grid-cols-3">

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Reported
              </p>

              <p className="mt-1 font-medium">
                {formatDate(incident.reported_at)}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Company
              </p>

              <p className="mt-1 font-medium">
                {incident.company}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Category
              </p>

              <p className="mt-1 font-medium">
                {incident.category}
              </p>
            </div>

          </div>

          <div className="mt-10">

            <h2 className="text-xl font-bold">
              Summary
            </h2>

            <p className="mt-4 text-lg leading-8 text-slate-600">
              {incident.summary}
            </p>

          </div>

          <div className="mt-10">

            <h2 className="text-xl font-bold">
              What happened?
            </h2>

            <p className="mt-4 leading-8 text-slate-600">
              {incident.description}
            </p>

          </div>

          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6">

            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Primary source
            </p>

            <h2 className="mt-2 text-xl font-bold">
              {incident.source_name}
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Frontier links to external reporting so
              readers can review the underlying source.
            </p>

            <a
              href={incident.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Read original source →
            </a>

          </div>

        </article>

      </main>
    </div>
  );
}