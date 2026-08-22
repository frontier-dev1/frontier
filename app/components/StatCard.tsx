type StatCardProps = {
  label: string;
  value: number;
  accent?:
    | "critical"
    | "high"
    | "primary"
    | "default";
  description?: string;
};

export default function StatCard({
  label,
  value,
  accent = "default",
  description,
}: StatCardProps) {
  const accentStyles = {
    default:
      "bg-slate-900",

    primary:
      "bg-blue-600",

    critical:
      "bg-red-500",

    high:
      "bg-orange-500",
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(15,23,42,0.07)]">
      <div
        className={`absolute left-0 top-0 h-1 w-full ${accentStyles[accent]}`}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            {label}
          </p>

          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            {value}
          </p>

          {description && (
            <p className="mt-1 text-xs text-slate-400">
              {description}
            </p>
          )}
        </div>

        <div
          className={`mt-1 h-2.5 w-2.5 rounded-full ${accentStyles[accent]} opacity-70`}
        />
      </div>
    </div>
  );
}