// app/components/IncidentCard.tsx

import Link from "next/link";
import  SeverityBadge  from "./SeverityBadge";

// Helper function to safely format dates and prevent "Invalid Date"
function formatDateSafely(dateInput?: string | Date): string {
  if (!dateInput) return "N/A";
  
  const parsed = new Date(dateInput);
  if (isNaN(parsed.getTime())) {
    return "N/A";
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function IncidentCard({ incident }: { incident: any }) {
  // Extract date from all possible database keys
  const rawDate =
    incident.occurred_at ||
    incident.reportedAt ||
    incident.published_at ||
    incident.incident_date ||
    incident.date ||
    incident.created_at;

  const formattedDate = formatDateSafely(rawDate);

  return (
    <div className="flex flex-col justify-between border border-border rounded-xl p-5 bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <SeverityBadge severity={incident.severity || "medium"} />
          <span className="text-xs text-muted-foreground">{formattedDate}</span>
        </div>

        <h3 className="font-semibold text-lg line-clamp-2 leading-snug">
          {incident.title}
        </h3>

        <p className="text-sm text-muted-foreground line-clamp-3">
          {incident.summary || incident.description || "No description provided."}
        </p>
      </div>

      <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">
          {incident.company || "Unknown Company"} • {incident.model || incident.ai_model || "Unspecified Model"}
        </span>

        <Link
          href={`/incidents/${incident.id}`}
          className="text-primary font-medium hover:underline inline-flex items-center gap-1"
        >
          View Incident →
        </Link>
      </div>
    </div>
  );
}