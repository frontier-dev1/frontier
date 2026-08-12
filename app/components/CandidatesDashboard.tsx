"use client";

import { useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import type { Database } from "../../database.types";

type Candidate =
  Database["public"]["Tables"]["incident_candidates"]["Row"];

type Props = {
  initialCandidates: Candidate[];
  userEmail: string;
};

const statusStyles: Record<string, string> = {
  pending:
    "bg-blue-50 text-blue-700 border-blue-200",

  reviewing:
    "bg-yellow-50 text-yellow-700 border-yellow-200",

  accepted:
    "bg-green-50 text-green-700 border-green-200",

  rejected:
    "bg-slate-100 text-slate-500 border-slate-200",
};

export default function CandidatesDashboard({
  initialCandidates,
  userEmail,
}: Props) {
  const [candidates, setCandidates] =
    useState<Candidate[]>(initialCandidates);

  const [filter, setFilter] = useState("pending");

  const [runningDiscovery, setRunningDiscovery] =
    useState(false);

  const [discoveryMessage, setDiscoveryMessage] =
    useState("");

  async function runDiscovery() {
    setRunningDiscovery(true);
    setDiscoveryMessage("");

    try {
        const response = await fetch(
        "/api/discovery/run",
        {
            method: "POST",
        }
        );

        const result = await response.json();

        if (!response.ok) {
        throw new Error(
            result.error ||
            "Discovery failed."
        );
        }

        setDiscoveryMessage(
        `Discovery complete — found ${result.discovered} candidates.`
        );

        /*
        * Refresh the page so the new candidates
        * appear immediately.
        */
        window.location.reload();
    } catch (error) {
        setDiscoveryMessage(
        error instanceof Error
            ? error.message
            : "Discovery failed."
        );
    } finally {
        setRunningDiscovery(false);
    }
}

  const filteredCandidates = useMemo(() => {
    if (filter === "all") {
      return candidates;
    }

    return candidates.filter(
      (candidate) => candidate.status === filter
    );
  }, [candidates, filter]);

  async function updateStatus(
    id: string,
    status: "pending" | "reviewing" | "accepted" | "rejected"
  ) {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("incident_candidates")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    setCandidates((current) =>
      current.map((candidate) =>
        candidate.id === id ? data : candidate
      )
    );
  }

  async function deleteCandidate(id: string) {
    if (
      !window.confirm(
        "Delete this candidate?"
      )
    ) {
      return;
    }

    const supabase = createClient();

    const { error } = await supabase
      .from("incident_candidates")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setCandidates((current) =>
      current.filter(
        (candidate) => candidate.id !== id
      )
    );
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
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </button>
            </form>

          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">

        {/* Navigation */}

        <div className="mb-8 flex gap-2">

          <a
            href="/admin"
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-white"
          >
            Incidents
          </a>

          <a
            href="/admin/candidates"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Candidates
          </a>

        </div>

        {/* Header */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

        <div>
            <h2 className="text-2xl font-bold text-slate-950">
            Incident candidates
            </h2>

            <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Articles and reports discovered by Frontier
            that may represent an AI incident.
            </p>
        </div>

        <button
            onClick={runDiscovery}
            disabled={runningDiscovery}
            className="shrink-0 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
            {runningDiscovery
            ? "Scanning..."
            : "Run discovery"}
        </button>

        </div>

        {discoveryMessage && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {discoveryMessage}
        </div>
        )}

        {/* Filters */}

        <div className="mt-6 flex flex-wrap gap-2">

          {[
            ["pending", "Pending"],
            ["reviewing", "Reviewing"],
            ["accepted", "Accepted"],
            ["rejected", "Rejected"],
            ["all", "All"],
          ].map(([value, label]) => (

            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                filter === value
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>

          ))}

        </div>

        {/* Candidates */}

        <div className="mt-6 space-y-4">

          {filteredCandidates.length === 0 ? (

            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">

              <div className="text-3xl">
                ✓
              </div>

              <h3 className="mt-4 font-semibold text-slate-900">
                Nothing here
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                No candidates match this filter.
              </p>

            </div>

          ) : (

            filteredCandidates.map((candidate) => (

              <article
                key={candidate.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >

                <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          statusStyles[
                            candidate.status
                          ] ??
                          statusStyles.pending
                        }`}
                      >
                        {candidate.status}
                      </span>

                      {candidate.relevance_score !== null && (
                        <span className="text-xs font-medium text-slate-400">
                          Relevance{" "}
                          {candidate.relevance_score}/100
                        </span>
                      )}

                    </div>

                    <h3 className="mt-3 text-lg font-bold text-slate-950">
                      {candidate.title}
                    </h3>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">

                      {candidate.source_name && (
                        <span>
                          Source: {candidate.source_name}
                        </span>
                      )}

                      {candidate.published_at && (
                        <span>
                          Published:{" "}
                          {new Date(
                            candidate.published_at
                          ).toLocaleDateString()}
                        </span>
                      )}

                    </div>

                    {candidate.summary && (
                      <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
                        {candidate.summary}
                      </p>
                    )}

                    {candidate.matched_keywords &&
                      candidate.matched_keywords.length >
                        0 && (
                        <div className="mt-4 flex flex-wrap gap-2">

                          {candidate.matched_keywords.map(
                            (keyword) => (
                              <span
                                key={keyword}
                                className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500"
                              >
                                {keyword}
                              </span>
                            )
                          )}

                        </div>
                      )}

                  </div>

                  <div className="flex shrink-0 flex-col gap-2 lg:w-36">

                    <a
                      href={candidate.article_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Read source ↗
                    </a>

                    {candidate.status ===
                      "pending" && (
                      <button
                        onClick={() =>
                          updateStatus(
                            candidate.id,
                            "reviewing"
                          )
                        }
                        className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-400"
                      >
                        Review
                      </button>
                    )}

                    {candidate.status ===
                      "reviewing" && (
                      <>
                        <button
                          onClick={() =>
                            updateStatus(
                              candidate.id,
                              "accepted"
                            )
                          }
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
                        >
                          Accept
                        </button>

                        <button
                          onClick={() =>
                            updateStatus(
                              candidate.id,
                              "rejected"
                            )
                          }
                          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    <button
                      onClick={() =>
                        deleteCandidate(candidate.id)
                      }
                      className="rounded-lg px-4 py-2 text-xs text-red-500 hover:bg-red-50"
                    >
                      Delete
                    </button>

                  </div>

                </div>

              </article>

            ))

          )}

        </div>

      </main>

    </div>
  );
}