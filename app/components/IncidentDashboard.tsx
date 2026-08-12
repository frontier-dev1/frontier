"use client";

import { useState } from "react";
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

  const companies = [
    "All",
    ...Array.from(
      new Set(
        incidents.map((incident) => incident.company)
      )
    ),
  ];

  const filteredIncidents = incidents.filter((incident) => {
    const searchText = `
      ${incident.title}
      ${incident.company}
      ${incident.model ?? ""}
      ${incident.summary}
      ${incident.category ?? ""}
    `.toLowerCase();

    const matchesSearch = searchText.includes(
      search.toLowerCase()
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

  const criticalCount = incidents.filter(
    (incident) => incident.severity === "Critical"
  ).length;

  const highCount = incidents.filter(
    (incident) => incident.severity === "High"
  ).length;

  const thisMonth = incidents.filter((incident) => {
    if (!incident.reported_at) {
      return false;
    }

    const date = new Date(
      `${incident.reported_at}T00:00:00`
    );

    const now = new Date();

    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }).length;

  return (
    <>
      {/* Hero */}

      <section>
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
          AI Incident Intelligence
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          Tracking significant AI incidents.
        </h1>

        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-500">
          Frontier catalogs reported incidents involving
          unexpected, unintended, or concerning AI system
          behavior.
        </p>
      </section>

      {/* Statistics */}

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total incidents"
          value={incidents.length}
        />

        <StatCard
          label="Critical"
          value={criticalCount}
          accent="text-red-600"
        />

        <StatCard
          label="High severity"
          value={highCount}
          accent="text-orange-600"
        />

        <StatCard
          label="Reported this month"
          value={thisMonth}
          accent="text-blue-600"
        />
      </section>

      {/* Search / Filters */}

      <section className="mt-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">

            <input
              type="text"
              placeholder="Search incidents..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
            />

            <select
              value={severity}
              onChange={(e) =>
                setSeverity(e.target.value)
              }
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500"
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
              onChange={(e) =>
                setCompany(e.target.value)
              }
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500"
            >
              {companies.map((item) => (
                <option key={item} value={item}>
                  {item === "All"
                    ? "All companies"
                    : item}
                </option>
              ))}
            </select>

          </div>

        </div>
      </section>

      {/* Incidents */}

      <section className="mt-10">

        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-950">
            Recent incidents
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {filteredIncidents.length}{" "}
            {filteredIncidents.length === 1
              ? "incident"
              : "incidents"}{" "}
            found
          </p>
        </div>

        {filteredIncidents.length > 0 ? (
          <div className="space-y-4">
            {filteredIncidents.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={{
                  id: incident.id,
                  title: incident.title,
                  company: incident.company,
                  model: incident.model ?? "Unknown",
                  severity: incident.severity,
                  summary: incident.summary,
                  reportedAt:
                    incident.reported_at ?? "",
                }}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">

            <h3 className="font-semibold text-slate-900">
              No incidents found
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Try adjusting your search or filters.
            </p>

          </div>
        )}

      </section>
    </>
  );
}