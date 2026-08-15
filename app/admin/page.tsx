import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: admin } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!admin) {
    redirect("/");
  }

  const { data: incidents, error: incidentError } =
    await supabase
      .from("incidents")
      .select("*")
      .order("reported_at", {
        ascending: false,
      });

  if (incidentError) {
    throw new Error(incidentError.message);
  }

  const { data: latestRun, error: runError } =
    await supabase
      .from("discovery_runs")
      .select("*")
      .order("started_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

  if (runError) {
    throw new Error(runError.message);
  }

  const total = incidents?.length ?? 0;

  const critical =
    incidents?.filter(
      (incident) => incident.severity === "Critical"
    ).length ?? 0;

  const high =
    incidents?.filter(
      (incident) => incident.severity === "High"
    ).length ?? 0;

  const moderate =
    incidents?.filter(
      (incident) => incident.severity === "Moderate"
    ).length ?? 0;

  const discoveryOperational =
    latestRun?.status === "success";

  return (
    <div className="min-h-screen bg-slate-100">

      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <div>
            <div className="text-xs font-bold tracking-[0.25em] text-blue-600">
              FRONTIER
            </div>

            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              Admin Console
            </h1>
          </div>

          <div className="flex items-center gap-4">

            <span className="hidden text-sm text-slate-500 md:block">
              {user.email}
            </span>

            <form
              action="/api/admin/logout"
              method="post"
            >
              <button
                type="submit"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Sign out
              </button>
            </form>

          </div>

        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">

        {/* Navigation */}
        <nav className="mb-8 flex gap-2 overflow-x-auto">

          <AdminNavLink
            href="/admin"
            active
          >
            Overview
          </AdminNavLink>

          <AdminNavLink href="/admin/incidents">
            Incidents
          </AdminNavLink>

          <AdminNavLink href="/admin/candidates">
            Candidates
          </AdminNavLink>

          <AdminNavLink href="/admin/discovery">
            Discovery
          </AdminNavLink>

        </nav>

        {/* Welcome */}
        <div className="mb-8">

          <h2 className="text-3xl font-bold tracking-tight text-slate-950">
            Frontier overview
          </h2>

          <p className="mt-2 text-slate-500">
            Monitor incidents, discovery activity, and
            candidate reports from one place.
          </p>

        </div>

        {/* Discovery status */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">

            <div>

              <div className="flex items-center gap-3">

                <span
                  className={`h-3 w-3 rounded-full ${
                    discoveryOperational
                      ? "bg-emerald-500"
                      : "bg-red-500"
                  }`}
                />

                <h2 className="text-lg font-bold text-slate-950">
                  Discovery engine
                </h2>

              </div>

              <p className="mt-2 text-sm text-slate-500">
                {latestRun
                  ? `Last run: ${new Date(
                      latestRun.started_at
                    ).toLocaleString()}`
                  : "No discovery runs recorded yet."}
              </p>

            </div>

            <Link
              href="/admin/discovery"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              View discovery history →
            </Link>

          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">

            <Metric
              label="Articles scanned"
              value={latestRun?.discovered ?? 0}
            />

            <Metric
              label="New candidates"
              value={latestRun?.inserted ?? 0}
              color="blue"
            />

            <Metric
              label="Run status"
              value={
                latestRun?.status === "success"
                  ? "Success"
                  : latestRun?.status === "failed"
                    ? "Failed"
                    : "—"
              }
              color={
                latestRun?.status === "success"
                  ? "green"
                  : "red"
              }
            />

          </div>

        </section>

        {/* Incident stats */}
        <section className="mt-8">

          <div className="mb-4">

            <h2 className="text-xl font-bold text-slate-950">
              Incident overview
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Published incidents currently tracked by Frontier.
            </p>

          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            <Metric
              label="Total incidents"
              value={total}
            />

            <Metric
              label="Critical"
              value={critical}
              color="red"
            />

            <Metric
              label="High"
              value={high}
              color="orange"
            />

            <Metric
              label="Moderate"
              value={moderate}
              color="yellow"
            />

          </div>

        </section>

        {/* Quick actions */}
        <section className="mt-8 grid gap-4 md:grid-cols-3">

          <QuickLink
            href="/admin/incidents"
            title="Manage incidents"
            description="Create, edit, and remove published incidents."
          />

          <QuickLink
            href="/admin/candidates"
            title="Review candidates"
            description="Review reports discovered by Frontier's scraper."
          />

          <QuickLink
            href="/admin/discovery"
            title="Monitor discovery"
            description="View scraper runs and system activity."
          />

        </section>

      </main>

    </div>
  );
}

function AdminNavLink({
  href,
  children,
  active = false,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          : "rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-white hover:text-slate-900"
      }
    >
      {children}
    </Link>
  );
}

function Metric({
  label,
  value,
  color = "blue",
}: {
  label: string;
  value: number | string;
  color?: "blue" | "red" | "orange" | "yellow" | "green";
}) {
  const colors = {
    blue: "text-blue-600",
    red: "text-red-600",
    orange: "text-orange-600",
    yellow: "text-yellow-600",
    green: "text-emerald-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">

      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p
        className={`mt-2 text-3xl font-bold ${colors[color]}`}
      >
        {value}
      </p>

    </div>
  );
}

function QuickLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-sm"
    >

      <h3 className="font-semibold text-slate-950 group-hover:text-blue-600">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {description}
      </p>

      <div className="mt-4 text-sm font-semibold text-blue-600">
        Open →
      </div>

    </Link>
  );
}