import Link from "next/link";
import SeverityBadge from "./SeverityBadge";

type Incident = {
  id: string;
  title: string;
  company: string;
  model: string;
  severity: string;
  summary: string;
  reportedAt: string;
};

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

export default function IncidentCard({
  incident,
}: {
  incident: Incident;
}) {
  return (
    <Link
      href={`/incident/${incident.id}`}
      className="group block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">

        <div className="min-w-0">

          <div className="mb-3">
            <SeverityBadge severity={incident.severity} />
          </div>

          <h2 className="text-xl font-semibold tracking-tight text-slate-950 group-hover:text-blue-600">
            {incident.title}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {incident.company} · {incident.model}
          </p>

        </div>

      </div>

      <p className="mt-5 leading-7 text-slate-600">
        {incident.summary}
      </p>

      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">

        <span className="text-sm text-slate-400">
          Reported {formatDate(incident.reportedAt)}
        </span>

        <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600">
          View incident →
        </span>

      </div>

    </Link>
  );
}