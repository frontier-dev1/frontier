type StatCardProps = {
  label: string;
  value: number;
  accent?: string;
};

export default function StatCard({
  label,
  value,
  accent = "text-slate-900",
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>

      <p className={`mt-2 text-3xl font-bold ${accent}`}>
        {value}
      </p>
    </div>
  );
}