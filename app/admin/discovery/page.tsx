import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";

export default async function DiscoveryPage() {
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

  const { data: runs, error } = await supabase
    .from("discovery_runs")
    .select("*")
    .order("started_at", {
      ascending: false,
    })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="min-h-screen bg-slate-100">

      <header className="border-b border-slate-200 bg-white">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <div>
            <div className="text-xs font-bold tracking-[0.25em] text-blue-600">
              FRONTIER
            </div>

            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              Discovery
            </h1>
          </div>

          <span className="text-sm text-slate-500">
            {user.email}
          </span>

        </div>

      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">

        <nav className="mb-8 flex gap-2 overflow-x-auto">

          <NavLink href="/admin">
            Overview
          </NavLink>

          <NavLink href="/admin/incidents">
            Incidents
          </NavLink>

          <NavLink href="/admin/candidates">
            Candidates
          </NavLink>

          <NavLink
            href="/admin/discovery"
            active
          >
            Discovery
          </NavLink>

        </nav>

        <div className="mb-8">

          <h2 className="text-3xl font-bold text-slate-950">
            Discovery history
          </h2>

          <p className="mt-2 text-slate-500">
            Monitor automated and manual discovery runs.
          </p>

        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

          {runs?.length === 0 ? (

            <div className="px-6 py-16 text-center">

              <h3 className="font-semibold text-slate-900">
                No discovery runs yet
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Frontier hasn't recorded a discovery run.
              </p>

            </div>

          ) : (

            <div className="divide-y divide-slate-100">

              {runs?.map((run) => (

                <div
                  key={run.id}
                  className="p-6"
                >

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                    <div>

                      <div className="flex items-center gap-3">

                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            run.status === "success"
                              ? "bg-emerald-500"
                              : run.status === "failed"
                                ? "bg-red-500"
                                : "bg-yellow-500"
                          }`}
                        />

                        <span className="font-semibold text-slate-950">
                          {run.status === "success"
                            ? "Success"
                            : run.status === "failed"
                              ? "Failed"
                              : "Running"}
                        </span>

                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        {new Date(
                          run.started_at
                        ).toLocaleString()}
                      </p>

                      {run.error_message && (
                        <p className="mt-2 text-sm text-red-600">
                          {run.error_message}
                        </p>
                      )}

                    </div>

                    <div className="grid grid-cols-2 gap-8 sm:text-right">

                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Scanned
                        </p>

                        <p className="mt-1 text-xl font-bold text-slate-950">
                          {run.discovered}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          New
                        </p>

                        <p className="mt-1 text-xl font-bold text-blue-600">
                          {run.inserted}
                        </p>
                      </div>

                    </div>

                  </div>

                </div>

              ))}

            </div>

          )}

        </div>

      </main>

    </div>
  );
}

function NavLink({
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