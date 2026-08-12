type Severity = "Low" | "Moderate" | "High" | "Critical";

const styles: Record<Severity, string> = {
  Low: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Moderate: "bg-yellow-50 text-yellow-700 ring-yellow-600/20",
  High: "bg-orange-50 text-orange-700 ring-orange-600/20",
  Critical: "bg-red-50 text-red-700 ring-red-600/20",
};

export default function SeverityBadge({
  severity,
}: {
  severity: string;
}) {
  const style =
    styles[severity as Severity] ??
    "bg-slate-50 text-slate-600 ring-slate-600/20";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style}`}
    >
      {severity}
    </span>
  );
}