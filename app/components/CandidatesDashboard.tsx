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

type ReviewForm = {
  title: string;
  company: string;
  model: string;
  severity: string;
  category: string;
  occurredAt: string;
  summary: string;
  description: string;
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

const severityStyles: Record<string, string> = {
  Critical:
    "bg-red-50 text-red-700 border-red-200",

  High:
    "bg-orange-50 text-orange-700 border-orange-200",

  Moderate:
    "bg-yellow-50 text-yellow-700 border-yellow-200",

  Low:
    "bg-blue-50 text-blue-700 border-blue-200",
};

const INCIDENT_CATEGORIES = [
  "Autonomous Agent",
  "Cybersecurity",
  "Deception",
  "Hallucination",
  "Privacy",
  "Safety",
  "Manipulation",
  "Unauthorized Action",
  "Other",
];

export default function CandidatesDashboard({
  initialCandidates,
  userEmail,
}: Props) {
  const [candidates, setCandidates] =
    useState<Candidate[]>(initialCandidates);

  const [filter, setFilter] =
    useState("pending");

  const [runningDiscovery, setRunningDiscovery] =
    useState(false);

  const [discoveryMessage, setDiscoveryMessage] =
    useState("");

  const [reviewingCandidate, setReviewingCandidate] =
    useState<Candidate | null>(null);

  const [reviewForm, setReviewForm] =
    useState<ReviewForm>({
      title: "",
      company: "",
      model: "",
      severity: "Moderate",
      category: "",
      occurredAt: "",
      summary: "",
      description: "",
    });

  const [publishing, setPublishing] =
    useState(false);

  const filteredCandidates = useMemo(() => {
    if (filter === "all") {
      return candidates;
    }

    return candidates.filter(
      (candidate) =>
        candidate.status === filter
    );
  }, [candidates, filter]);

  const counts = {
    all: candidates.length,
    pending: candidates.filter(
      (candidate) =>
        candidate.status === "pending"
    ).length,
    reviewing: candidates.filter(
      (candidate) =>
        candidate.status === "reviewing"
    ).length,
    accepted: candidates.filter(
      (candidate) =>
        candidate.status === "accepted"
    ).length,
    rejected: candidates.filter(
      (candidate) =>
        candidate.status === "rejected"
    ).length,
  };

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
        `Discovery complete — found ${result.discovered} candidates and inserted ${result.inserted}.`
      );

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

  function openReview(candidate: Candidate) {
    setReviewingCandidate(candidate);

    setReviewForm({
      title: candidate.title,
      company: "",
      model: "",
      severity: "Moderate",
      category: "",
      occurredAt: candidate.published_at
        ? candidate.published_at.slice(0, 10)
        : "",
      summary: candidate.summary ?? "",
      description: candidate.summary ?? "",
    });
  }

  function closeReview() {
    if (publishing) return;

    setReviewingCandidate(null);
  }

  function updateForm(
    field: keyof ReviewForm,
    value: string
  ) {
    setReviewForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function publishIncident(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!reviewingCandidate) return;

    setPublishing(true);

    const supabase = createClient();

    const incidentId =
      crypto.randomUUID();

    const incident = {
      id: incidentId,
      title: reviewForm.title.trim(),
      company: reviewForm.company.trim(),
      model:
        reviewForm.model.trim() || null,
      severity: reviewForm.severity,
      category:
        reviewForm.category.trim() || null,
      occurred_at:
        reviewForm.occurredAt || null,
      reported_at:
        reviewingCandidate.published_at
          ? reviewingCandidate.published_at.slice(
              0,
              10
            )
          : null,
      updated_at:
        new Date()
          .toISOString()
          .slice(0, 10),
      summary:
        reviewForm.summary.trim(),
      description:
        reviewForm.description.trim(),
      source_name:
        reviewingCandidate.source_name ||
        "Unknown source",
      source_url:
        reviewingCandidate.article_url,
      verification_status:
        "Reported",
      additional_sources: [],
      tags: [],
    };

    const {
      data: createdIncident,
      error: incidentError,
    } =
      await supabase
        .from("incidents")
        .insert(incident)
        .select()
        .single();

    if (incidentError) {
      setPublishing(false);

      alert(
        `Unable to publish incident: ${incidentError.message}`
      );

      return;
    }

    const {
      data: updatedCandidate,
      error: candidateError,
    } =
      await supabase
        .from("incident_candidates")
        .update({
          status: "accepted",
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          reviewingCandidate.id
        )
        .select()
        .single();

    if (candidateError) {
      /*
       * The incident was created successfully,
       * but the candidate status failed to update.
       *
       * We don't delete the incident automatically
       * because we don't want to accidentally lose
       * a legitimate published incident.
       */
      setPublishing(false);

      alert(
        `Incident published, but the candidate status could not be updated: ${candidateError.message}`
      );

      setCandidates((current) =>
        current.map((candidate) =>
          candidate.id ===
          reviewingCandidate.id
            ? {
                ...candidate,
                status: "accepted",
              }
            : candidate
        )
      );

      setReviewingCandidate(null);

      return;
    }

    setCandidates((current) =>
      current.map((candidate) =>
        candidate.id ===
        reviewingCandidate.id
          ? updatedCandidate
          : candidate
      )
    );

    setPublishing(false);
    setReviewingCandidate(null);

    alert(
      `Incident "${createdIncident.title}" published successfully.`
    );
  }

  async function rejectCandidate(
    candidate: Candidate
  ) {
    const confirmed = window.confirm(
      "Reject this candidate?"
    );

    if (!confirmed) return;

    const supabase = createClient();

    const { data, error } =
      await supabase
        .from("incident_candidates")
        .update({
          status: "rejected",
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", candidate.id)
        .select()
        .single();

    if (error) {
      alert(error.message);
      return;
    }

    setCandidates((current) =>
      current.map((item) =>
        item.id === candidate.id
          ? data
          : item
      )
    );
  }

  async function deleteCandidate(
    id: string
  ) {
    if (
      !window.confirm(
        "Delete this candidate?"
      )
    ) {
      return;
    }

    const supabase = createClient();

    const { error } =
      await supabase
        .from("incident_candidates")
        .delete()
        .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setCandidates((current) =>
      current.filter(
        (candidate) =>
          candidate.id !== id
      )
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

        {/* Stats */}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">

          <CandidateStat
            label="All"
            value={counts.all}
          />

          <CandidateStat
            label="Pending"
            value={counts.pending}
            color="blue"
          />

          <CandidateStat
            label="Reviewing"
            value={counts.reviewing}
            color="yellow"
          />

          <CandidateStat
            label="Accepted"
            value={counts.accepted}
            color="green"
          />

          <CandidateStat
            label="Rejected"
            value={counts.rejected}
          />

        </div>

        {/* Filters */}

        <div className="mt-6 flex flex-wrap gap-2">

          {[
            ["pending", "Pending"],
            ["reviewing", "Reviewing"],
            ["accepted", "Accepted"],
            ["rejected", "Rejected"],
            ["all", "All"],
          ].map(
            ([value, label]) => (
              <button
                key={value}
                onClick={() =>
                  setFilter(value)
                }
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  filter === value
                    ? "bg-blue-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            )
          )}

        </div>

        {/* Candidates */}

        <div className="mt-6 space-y-4">

          {filteredCandidates.length ===
          0 ? (

            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">

              <div className="text-3xl">
                ✓
              </div>

              <h3 className="mt-4 font-semibold text-slate-900">
                Nothing here
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                No candidates match this
                filter.
              </p>

            </div>

          ) : (

            filteredCandidates.map(
              (candidate) => {

                const isNew =
                  Date.now() -
                    new Date(
                      candidate.discovered_at
                    ).getTime() <
                  24 *
                    60 *
                    60 *
                    1000;

                return (
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
                            {
                              candidate.status
                            }
                          </span>

                          {isNew && (
                            <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
                              NEW
                            </span>
                          )}

                          {candidate.relevance_score !==
                            null && (
                            <span className="text-xs font-medium text-slate-400">
                              Relevance{" "}
                              {
                                candidate.relevance_score
                              }
                              /100
                            </span>
                          )}

                        </div>

                        <h3 className="mt-3 text-lg font-bold text-slate-950">
                          {candidate.title}
                        </h3>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">

                          {candidate.source_name && (
                            <span>
                              {
                                candidate.source_name
                              }
                            </span>
                          )}

                          <span>
                            Discovered{" "}
                            {new Date(
                              candidate.discovered_at
                            ).toLocaleString()}
                          </span>

                          {candidate.published_at && (
                            <span>
                              Published{" "}
                              {new Date(
                                candidate.published_at
                              ).toLocaleDateString()}
                            </span>
                          )}

                        </div>

                        {candidate.summary && (
                          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
                            {
                              candidate.summary
                            }
                          </p>
                        )}

                        {candidate.matched_keywords &&
                          candidate
                            .matched_keywords
                            .length >
                            0 && (
                            <div className="mt-4 flex flex-wrap gap-2">

                              {candidate.matched_keywords.map(
                                (
                                  keyword
                                ) => (
                                  <span
                                    key={
                                      keyword
                                    }
                                    className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500"
                                  >
                                    {
                                      keyword
                                    }
                                  </span>
                                )
                              )}

                            </div>
                          )}

                      </div>

                      <div className="flex shrink-0 flex-col gap-2 lg:w-36">

                        <a
                          href={
                            candidate.article_url
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Read source ↗
                        </a>

                        {(candidate.status ===
                          "pending" ||
                          candidate.status ===
                            "reviewing") && (
                          <button
                            onClick={() =>
                              openReview(
                                candidate
                              )
                            }
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                          >
                            Review
                          </button>
                        )}

                        {candidate.status ===
                          "reviewing" && (
                          <button
                            onClick={() =>
                              rejectCandidate(
                                candidate
                              )
                            }
                            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Reject
                          </button>
                        )}

                        <button
                          onClick={() =>
                            deleteCandidate(
                              candidate.id
                            )
                          }
                          className="rounded-lg px-4 py-2 text-xs text-red-500 hover:bg-red-50"
                        >
                          Delete
                        </button>

                      </div>

                    </div>

                  </article>
                );
              }
            )

          )}

        </div>

      </main>

      {/* Review modal */}

      {reviewingCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">

          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  Candidate review
                </div>

                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  Review incident
                </h2>
              </div>

              <button
                onClick={closeReview}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>

            </div>

            <form
              onSubmit={publishIncident}
              className="space-y-5 p-6"
            >

              {/* Source */}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Discovered source
                </p>

                <p className="mt-2 font-semibold text-slate-900">
                  {
                    reviewingCandidate.title
                  }
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {
                    reviewingCandidate.source_name
                  }
                </p>

                <a
                  href={
                    reviewingCandidate.article_url
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-500"
                >
                  Open original article ↗
                </a>

              </div>

              {/* Title */}

              <Field
                label="Incident title"
                required
              >
                <input
                  required
                  value={reviewForm.title}
                  onChange={(event) =>
                    updateForm(
                      "title",
                      event.target.value
                    )
                  }
                  className="input"
                />
              </Field>

              {/* Company / model */}

              <div className="grid gap-5 sm:grid-cols-2">

                <Field label="Company / organization" required>
                  <input
                    required
                    value={reviewForm.company}
                    onChange={(event) =>
                      updateForm(
                        "company",
                        event.target.value
                      )
                    }
                    placeholder="OpenAI"
                    className="input"
                  />
                </Field>

                <Field label="Model">
                  <input
                    value={reviewForm.model}
                    onChange={(event) =>
                      updateForm(
                        "model",
                        event.target.value
                      )
                    }
                    placeholder="GPT-5"
                    className="input"
                  />
                </Field>

              </div>

              {/* Severity / category */}

              <div className="grid gap-5 sm:grid-cols-2">

                <Field label="Severity" required>
                  <select
                    value={reviewForm.severity}
                    onChange={(event) =>
                      updateForm(
                        "severity",
                        event.target.value
                      )
                    }
                    className="input"
                  >
                    <option>
                      Critical
                    </option>
                    <option>
                      High
                    </option>
                    <option>
                      Moderate
                    </option>
                    <option>
                      Low
                    </option>
                  </select>
                </Field>

                <Field label="Category">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Category
                    </label>

                    <input
                      list="incident-categories"
                      value={reviewForm.category}
                      onChange={(event) =>
                        setReviewForm({
                          ...reviewForm,
                          category: event.target.value,
                        })
                      }
                      placeholder="Select or enter a category..."
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
                    />

                    <datalist id="incident-categories">
                      {INCIDENT_CATEGORIES.map((category) => (
                        <option
                          key={category}
                          value={category}
                        />
                      ))}
                    </datalist>

                    <p className="mt-2 text-xs text-slate-400">
                      Choose a suggested category or enter a new one.
                    </p>
                  </div>
                </Field>

              </div>

              {/* Occurred */}

              <Field label="Occurred date">
                <input
                  type="date"
                  value={
                    reviewForm.occurredAt
                  }
                  onChange={(event) =>
                    updateForm(
                      "occurredAt",
                      event.target.value
                    )
                  }
                  className="input"
                />
              </Field>

              {/* Summary */}

              <Field
                label="Summary"
                required
              >
                <textarea
                  required
                  rows={4}
                  value={reviewForm.summary}
                  onChange={(event) =>
                    updateForm(
                      "summary",
                      event.target.value
                    )
                  }
                  className="input resize-none"
                  placeholder="Briefly summarize the incident."
                />
              </Field>

              {/* Description */}

              <Field
                label="Description"
                required
              >
                <textarea
                  required
                  rows={7}
                  value={
                    reviewForm.description
                  }
                  onChange={(event) =>
                    updateForm(
                      "description",
                      event.target.value
                    )
                  }
                  className="input resize-none"
                  placeholder="Describe what happened, what the AI system did, and why it was outside the intended behavior."
                />
              </Field>

              {/* Actions */}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-between">

                <button
                  type="button"
                  onClick={() => {
                    closeReview();
                  }}
                  className="rounded-xl border border-red-200 px-5 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Cancel
                </button>

                <div className="flex gap-3">

                  <button
                    type="button"
                    disabled={publishing}
                    onClick={() => {
                      if (
                        reviewingCandidate
                      ) {
                        rejectCandidate(
                          reviewingCandidate
                        );

                        closeReview();
                      }
                    }}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Reject
                  </button>

                  <button
                    type="submit"
                    disabled={publishing}
                    className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                  >
                    {publishing
                      ? "Publishing..."
                      : "Publish incident"}
                  </button>

                </div>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}

function CandidateStat({
  label,
  value,
  color = "slate",
}: {
  label: string;
  value: number;
  color?:
    | "slate"
    | "blue"
    | "yellow"
    | "green";
}) {
  const colors = {
    slate: "text-slate-950",
    blue: "text-blue-600",
    yellow: "text-yellow-600",
    green: "text-green-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 text-2xl font-bold ${colors[color]}`}
      >
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">
        {label}
        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <div className="mt-2">
        {children}
      </div>
    </div>
  );
}