"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import type { Database } from "../../database.types";

type Incident =
  Database["public"]["Tables"]["incidents"]["Row"];

type Props = {
  initialIncidents: Incident[];
  userEmail: string;
  activePage?: "overview" | "incidents";
};

export function AdminDashboard({
  initialIncidents,
  userEmail,
  activePage = "incidents",
}: Props) {
  const [incidents, setIncidents] =
    useState<Incident[]>(initialIncidents);

  const [showForm, setShowForm] = useState(false);
  const [editingIncident, setEditingIncident] =
    useState<Incident | null>(null);

  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] =
    useState("All");

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const matchesSearch =
        search.trim() === "" ||
        incident.title
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        (incident.company ?? "")
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesSeverity =
        severityFilter === "All" ||
        incident.severity === severityFilter;

      return matchesSearch && matchesSeverity;
    });
  }, [incidents, search, severityFilter]);


const severityStyles: Record<string, string> = {
  Critical:
    "bg-red-100 text-red-700 border-red-200",
  High:
    "bg-orange-100 text-orange-700 border-orange-200",
  Moderate:
    "bg-yellow-100 text-yellow-700 border-yellow-200",
  Low:
    "bg-blue-100 text-blue-700 border-blue-200",
};


  const counts = {
    total: incidents.length,
    critical: incidents.filter(
      (i) => i.severity === "Critical"
    ).length,
    high: incidents.filter(
      (i) => i.severity === "High"
    ).length,
    moderate: incidents.filter(
      (i) => i.severity === "Moderate"
    ).length,
  };

  function handleAdd() {
    setEditingIncident(null);
    setShowForm(true);
  }

  function handleEdit(incident: Incident) {
    setEditingIncident(incident);
    setShowForm(true);
  }

  function handleSaved(incident: Incident) {
    setIncidents((current) => {
      const exists = current.some(
        (item) => item.id === incident.id
      );

      if (exists) {
        return current.map((item) =>
          item.id === incident.id ? incident : item
        );
      }

      return [incident, ...current];
    });

    setShowForm(false);
    setEditingIncident(null);
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm(
      "Delete this incident? This cannot be undone."
    );

    if (!confirmed) return;

    const supabase = createClient();

    const { error } = await supabase
      .from("incidents")
      .delete()
      .eq("id", id);

    if (error) {
      alert(`Unable to delete incident: ${error.message}`);
      return;
    }

    setIncidents((current) =>
      current.filter((incident) => incident.id !== id)
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
              Admin Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-4">

            <span className="hidden text-sm text-slate-500 md:block">
              {userEmail}
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

      {/* Main */}
      <main className="mx-auto max-w-7xl px-6 py-8">

        {/* Navigation */}
        <nav className="mb-8 flex gap-2 overflow-x-auto">

          <AdminNavLink
            href="/admin"
            active={activePage === "overview"}
          >
            Overview
          </AdminNavLink>

          <AdminNavLink
            href="/admin/incidents"
            active={activePage === "incidents"}
          >
            Incidents
          </AdminNavLink>

          <AdminNavLink href="/admin/candidates">
            Candidates
          </AdminNavLink>

          <AdminNavLink href="/admin/discovery">
            Discovery
          </AdminNavLink>

        </nav>


        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <Stat
            label="Total incidents"
            value={counts.total}
          />

          <Stat
            label="Critical"
            value={counts.critical}
            color="red"
          />

          <Stat
            label="High"
            value={counts.high}
            color="orange"
          />

          <Stat
            label="Moderate"
            value={counts.moderate}
            color="yellow"
          />

        </div>

        {/* Incidents */}
        <section className="mt-8">

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

            <div>
              <h2 className="text-xl font-bold text-slate-950">
                Incidents
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Manage the incidents displayed on Frontier.
              </p>
            </div>

            <button
              onClick={handleAdd}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
            >
              + Add incident
            </button>

          </div>

          {/* Filters */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search incidents..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 sm:max-w-md"
            />

            <select
              value={severityFilter}
              onChange={(event) =>
                setSeverityFilter(event.target.value)
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
            >
              <option value="All">All severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Moderate">Moderate</option>
              <option value="Low">Low</option>
            </select>

          </div>

          {/* List */}
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">

            {filteredIncidents.length === 0 ? (

              <div className="px-6 py-16 text-center">

                <div className="text-4xl">◌</div>

                <h3 className="mt-4 font-semibold text-slate-900">
                  No incidents found
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Try changing your filters or add a new incident.
                </p>

              </div>

            ) : (

              <div className="divide-y divide-slate-100">

                {filteredIncidents.map((incident) => (

                  <div
                    key={incident.id}
                    className="p-6 transition hover:bg-slate-50"
                  >

                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                      <div className="min-w-0">

                        <div className="flex flex-wrap items-center gap-2">

                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              severityStyles[
                                incident.severity
                              ] ??
                              "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {incident.severity}
                          </span>

                          {incident.company && (
                            <span className="text-xs font-medium text-slate-500">
                              {incident.company}
                            </span>
                          )}

                        </div>

                        <h3 className="mt-2 text-lg font-semibold text-slate-950">
                          {incident.title}
                        </h3>

                        {incident.summary && (
                          <p className="mt-1 line-clamp-2 max-w-3xl text-sm text-slate-500">
                            {incident.summary}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">

                          {incident.model && (
                            <span>
                              Model: {incident.model}
                            </span>
                          )}

                          {incident.reported_at && (
                            <span>
                              Reported:{" "}
                              {new Date(
                                incident.reported_at
                              ).toLocaleDateString()}
                            </span>
                          )}

                        </div>

                      </div>

                      <div className="flex shrink-0 gap-2">

                        <button
                          onClick={() =>
                            handleEdit(incident)
                          }
                          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() =>
                            handleDelete(incident.id)
                          }
                          className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>

                      </div>

                    </div>

                  </div>

                ))}

              </div>

            )}

          </div>

        </section>

      </main>

      {/* Modal */}
      {showForm && (
        <IncidentForm
          incident={editingIncident}
          onClose={() => {
            setShowForm(false);
            setEditingIncident(null);
          }}
          onSaved={handleSaved}
        />
      )}

    </div>
  );
}

function Stat({
  label,
  value,
  color = "blue",
}: {
  label: string;
  value: number;
  color?: "blue" | "red" | "orange" | "yellow";
}) {
  const colors = {
    blue: "text-blue-600",
    red: "text-red-600",
    orange: "text-orange-600",
    yellow: "text-yellow-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
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

function IncidentForm({
  incident,
  onClose,
  onSaved,
}: {
  incident: Incident | null;
  onClose: () => void;
  onSaved: (incident: Incident) => void;
}) {
  const supabase = createClient();

  const [title, setTitle] = useState(
    incident?.title ?? ""
  );

  const [company, setCompany] = useState(
    incident?.company ?? ""
  );

  const [model, setModel] = useState(
    incident?.model ?? ""
  );

  const [severity, setSeverity] = useState(
    incident?.severity ?? "Moderate"
  );

  const [summary, setSummary] = useState(
    incident?.summary ?? ""
  );

  const [sourceUrl, setSourceUrl] = useState(
    incident?.source_url ?? ""
  );

  const [reportedAt, setReportedAt] = useState(
    incident?.reported_at
      ? incident.reported_at.slice(0, 16)
      : ""
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveIncident(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");

    const payload = {
      title,
      company: company || null,
      model: model || null,
      severity,
      summary: summary || null,
      source_url: sourceUrl || null,
      reported_at: reportedAt
        ? new Date(reportedAt).toISOString()
        : null,
    };

    const result = incident
      ? await supabase
          .from("incidents")
          .update(payload)
          .eq("id", incident.id)
          .select()
          .single()
      : await supabase
          .from("incidents")
          .insert(payload)
          .select()
          .single();

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    onSaved(result.data);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">

      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

          <div>
            <h2 className="text-xl font-bold text-slate-950">
              {incident
                ? "Edit incident"
                : "Add incident"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Information entered here will appear on Frontier.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>

        </div>

        <form
          onSubmit={saveIncident}
          className="space-y-5 p-6"
        >

          <div>
            <label className="text-sm font-semibold text-slate-700">
              Incident title *
            </label>

            <input
              required
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              placeholder="e.g. OpenAI research agent accessed unauthorized systems"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Company / organization
              </label>

              <input
                value={company}
                onChange={(event) =>
                  setCompany(event.target.value)
                }
                placeholder="OpenAI"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Model
              </label>

              <input
                value={model}
                onChange={(event) =>
                  setModel(event.target.value)
                }
                placeholder="GPT-5"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>

          </div>

          <div className="grid gap-5 sm:grid-cols-2">

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Severity *
              </label>

              <select
                value={severity}
                onChange={(event) =>
                  setSeverity(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
              >
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
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Reported at
              </label>

              <input
                type="datetime-local"
                value={reportedAt}
                onChange={(event) =>
                  setReportedAt(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>

          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">
              Summary
            </label>

            <textarea
              rows={5}
              value={summary}
              onChange={(event) =>
                setSummary(event.target.value)
              }
              placeholder="Briefly describe what happened..."
              className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">
              Primary source URL
            </label>

            <input
              type="url"
              value={sourceUrl}
              onChange={(event) =>
                setSourceUrl(event.target.value)
              }
              placeholder="https://..."
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />

            <p className="mt-2 text-xs text-slate-400">
              Prefer reputable journalism, research papers,
              company reports, or other primary sources.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : incident
                  ? "Save changes"
                  : "Create incident"}
            </button>

          </div>

        </form>

      </div>

    </div>
  );
}