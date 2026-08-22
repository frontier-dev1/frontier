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
  if (!date) {
    return "Unknown";
  }

  return new Date(
    `${date}T00:00:00`
  ).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function severityAccent(severity: string) {
  switch (severity) {
    case "Critical":
      return "bg-red-500";

    case "High":
      return "bg-orange-500";

    case "Moderate":
      return "bg-yellow-500";

    case "Low":
      return "bg-emerald-500";

    default:
      return "bg-slate-400";
  }
}

export default function IncidentCard({
  incident,
}: {
  incident: Incident;
}) {
  return (
    <Link
      href={`/incident/${incident.id}`}
      className="group relative block overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_18px_50px_rgba(15,23,42,0.09)]"
    >
      {/* Accent line */}

      <div
        className={`absolute left-0 top-0 h-full w-1 ${severityAccent(
          incident.severity
        )}`}
      />

      <div className="pl-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <SeverityBadge
                severity={incident.severity}
              />

              <span className="text-xs text-slate-400">
                {formatDate(
                  incident.reportedAt
                )}
              </span>
            </div>

            <h2 className="text-xl font-bold tracking-tight text-slate-950 transition-colors group-hover:text-blue-600 sm:text-[22px]">
              {incident.title}
            </h2>

            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
              <span className="font-medium text-slate-700">
                {incident.company}
              </span>

              <span className="text-slate-300">
                •
              </span>

              <span>{incident.model}</span>
            </div>
          </div>

          <span className="hidden shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-600 sm:block">
            View incident →
          </span>
        </div>

        <p className="mt-5 max-w-4xl text-sm leading-7 text-slate-600">
          {incident.summary}
        </p>

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 sm:hidden">
          <span className="text-xs text-slate-400">
            Reported{" "}
            {formatDate(
              incident.reportedAt
            )}
          </span>

          <span className="text-sm font-semibold text-blue-600">
            View incident →
          </span>
        </div>
      </div>
    </Link>
  );
}