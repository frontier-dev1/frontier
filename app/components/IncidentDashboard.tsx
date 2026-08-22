"use client";

import { useMemo, useState } from "react";
import IncidentCard from "./IncidentCard";
import StatCard from "./StatCard";
import type { Database } from "../../database.types";

type Incident =
  Database["public"]["Tables"]["incidents"]["Row"];

export default function IncidentDashboard({
  incidents,
}: {
  incidents: Incident[];
}) {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("All");
  const [company, setCompany] = useState("All");

  const companies = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          incidents.map(
            (incident) => incident.company
          )
        )
      ).sort(),
    ],
    [incidents]
  );

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const searchText = `
        ${incident.title}
        ${incident.company}
        ${incident.model ?? ""}
        ${incident.summary}
        ${incident.description ?? ""}
        ${incident.category ?? ""}
      `.toLowerCase();

      const matchesSearch =
        searchText.includes(
          search.toLowerCase().trim()
        );

      const matchesSeverity =
        severity === "All" ||
        incident.severity === severity;

      const matchesCompany =
        company === "All" ||
        incident.company === company;

      return (
        matchesSearch &&
        matchesSeverity &&
        matchesCompany
      );
    });
  }, [
    incidents,
    search,
    severity,
    company,
  ]);

  const criticalCount = incidents.filter(
    (incident) =>
      incident.severity === "Critical"
  ).length;

  const highCount = incidents.filter(
    (incident) =>
      incident.severity === "High"
  ).length;

  const thisMonth = incidents.filter(
    (incident) => {
      if (!incident.reported_at) {
        return false;
      }

      const date = new Date(
        `${incident.reported_at}T00:00:00`
      );

      const now = new Date();

      return (
        date.getMonth() === now.getMonth() &&
        date.getFullYear() ===
          now.getFullYear()
      );
    }
  ).length;

  return (
    <div>
      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="relative overflow-hidden bg-[#07111f]">
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:64px_64px]" />

        {/* Glow */}
        <div className="absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-[120px]" />

        <div className="absolute -bottom-40 left-1/4 h-[400px] w-[400px] rounded-full bg-cyan-400/10 blur-[120px]" />

        <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-20 sm:pb-24 sm:pt-24">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]" />
              AI Incident Intelligence
            </div>

            <h1 className="mt-7 max-w-4xl text-5xl font-bold tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
              Tracking when AI
              <span className="bg-gradient-to-r from-blue-300 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                {" "}
                behaves unexpectedly.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              Frontier catalogs significant incidents
              involving unexpected, unintended, or
              concerning AI system behavior — creating
              a structured record of how increasingly
              capable systems behave in the real world.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3 text-sm">
              <div className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-slate-300 backdrop-blur">
                <span className="font-semibold text-white">
                  {incidents.length}
                </span>{" "}
                incidents tracked
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-slate-300 backdrop-blur">
                Updated continuously
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <section className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
        {/* Statistics */}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total incidents"
            value={incidents.length}
            description="Across the Frontier database"
          />

          <StatCard
            label="Critical"
            value={criticalCount}
            accent="critical"
            description="Highest severity incidents"
          />

          <StatCard
            label="High severity"
            value={highCount}
            accent="high"
            description="Significant system behavior"
          />

          <StatCard
            label="Reported this month"
            value={thisMonth}
            accent="primary"
            description="Newly reported incidents"
          />
        </div>

        {/* Database header */}

        <div className="mt-16 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
              Incident database
            </div>

            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Explore the incidents
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Search and filter reported AI incidents
              across companies, models, and severity
              levels.
            </p>
          </div>

          <div className="text-sm text-slate-400">
            Showing{" "}
            <span className="font-semibold text-slate-700">
              {filteredIncidents.length}
            </span>{" "}
            of {incidents.length}
          </div>
        </div>

        {/* Search */}

        <section className="mt-7">
          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_10px_40px_rgba(15,23,42,0.06)]">
            <div className="grid gap-2 md:grid-cols-[1fr_190px_190px]">
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="7"
                  />
                  <path d="m20 20-3.5-3.5" />
                </svg>

                <input
                  type="text"
                  placeholder="Search incidents, companies, models..."
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  className="h-12 w-full rounded-xl bg-slate-50 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
                />
              </div>

              <select
                value={severity}
                onChange={(event) =>
                  setSeverity(
                    event.target.value
                  )
                }
                className="h-12 rounded-xl bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:bg-white focus:ring-2 focus:ring-blue-500/15"
              >
                <option value="All">
                  All severities
                </option>
                <option value="Critical">
                  Critical
                </option>
                <option value="High">
                  High
                </option>
                <option value="Moderate">
                  Moderate
                </option>
                <option value="Low">
                  Low
                </option>
              </select>

              <select
                value={company}
                onChange={(event) =>
                  setCompany(
                    event.target.value
                  )
                }
                className="h-12 rounded-xl bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:bg-white focus:ring-2 focus:ring-blue-500/15"
              >
                {companies.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item === "All"
                      ? "All companies"
                      : item}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Results */}

        <section className="mt-10">
          {filteredIncidents.length > 0 ? (
            <div className="space-y-4">
              {filteredIncidents.map(
                (incident) => (
                  <IncidentCard
                    key={incident.id}
                    incident={{
                      id: incident.id,
                      title:
                        incident.title,
                      company:
                        incident.company,
                      model:
                        incident.model ??
                        "Unknown",
                      severity:
                        incident.severity,
                      summary:
                        incident.summary,
                      reportedAt:
                        incident.reported_at ??
                        "",
                    }}
                  />
                )
              )}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="7"
                  />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </div>

              <h3 className="mt-5 font-semibold text-slate-900">
                No incidents found
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Try adjusting your search or
                filters.
              </p>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}