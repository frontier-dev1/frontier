"use client";

import { useMemo, useState } from "react";
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

type CandidateFilter =
  | "all"
  | "pending"
  | "reviewing"
  | "accepted"
  | "rejected"
  | "ai-reviewed"
  | "ai-recommended";

type RecommendationFilter =
  | "all"
  | "publish"
  | "review"
  | "reject";

type SortOption =
  | "newest"
  | "oldest"
  | "relevance"
  | "confidence"
  | "evidence";

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

const MAX_BATCH_SIZE = 5;

export default function CandidatesDashboard({
  initialCandidates,
  userEmail,
}: Props) {
  const [candidates, setCandidates] =
    useState<Candidate[]>(initialCandidates);

  const [filter, setFilter] =
    useState<CandidateFilter>("pending");

  const [recommendationFilter, setRecommendationFilter] =
    useState<RecommendationFilter>("all");

  const [severityFilter, setSeverityFilter] =
    useState("all");

  const [categoryFilter, setCategoryFilter] =
    useState("all");

  const [searchQuery, setSearchQuery] =
    useState("");

  const [sortOption, setSortOption] =
    useState<SortOption>("newest");

  const [selectedIds, setSelectedIds] =
    useState<Set<string>>(new Set());

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

  const [aiReviewing, setAiReviewing] =
    useState(false);

  const [batchReviewing, setBatchReviewing] =
    useState(false);

  const [batchProgress, setBatchProgress] =
    useState({
      completed: 0,
      failed: 0,
      total: 0,
    });

  const [batchMessage, setBatchMessage] =
    useState("");

  /*
   * ------------------------------------------------------------
   * Candidate counts
   * ------------------------------------------------------------
   */

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

    aiReviewed: candidates.filter(
      (candidate) =>
        candidate.ai_review_status ===
        "completed"
    ).length,

    aiRecommended: candidates.filter(
      (candidate) =>
        candidate.ai_review_status ===
          "completed" &&
        candidate.ai_recommendation ===
          "publish"
    ).length,
  };

  /*
   * ------------------------------------------------------------
   * Filtering + sorting
   * ------------------------------------------------------------
   */

  const filteredCandidates = useMemo(() => {
    let result = [...candidates];

    /*
     * Primary status / AI filter
     */

    if (filter === "pending") {
      result = result.filter(
        (candidate) =>
          candidate.status === "pending"
      );
    }

    if (filter === "reviewing") {
      result = result.filter(
        (candidate) =>
          candidate.status === "reviewing"
      );
    }

    if (filter === "accepted") {
      result = result.filter(
        (candidate) =>
          candidate.status === "accepted"
      );
    }

    if (filter === "rejected") {
      result = result.filter(
        (candidate) =>
          candidate.status === "rejected"
      );
    }

    if (filter === "ai-reviewed") {
      result = result.filter(
        (candidate) =>
          candidate.ai_review_status ===
          "completed"
      );
    }

    if (filter === "ai-recommended") {
      result = result.filter(
        (candidate) =>
          candidate.ai_review_status ===
            "completed" &&
          candidate.ai_recommendation ===
            "publish"
      );
    }

    /*
     * AI recommendation
     */

    if (
      recommendationFilter !==
      "all"
    ) {
      result = result.filter(
        (candidate) =>
          candidate.ai_recommendation ===
          recommendationFilter
      );
    }

    /*
     * Severity
     */

    if (severityFilter !== "all") {
      result = result.filter(
        (candidate) =>
          candidate.ai_severity ===
          severityFilter
      );
    }

    /*
     * Category
     */

    if (categoryFilter !== "all") {
      result = result.filter(
        (candidate) =>
          candidate.ai_category ===
          categoryFilter
      );
    }

    /*
     * Search
     */

    const query =
      searchQuery
        .trim()
        .toLowerCase();

    if (query) {
      result = result.filter(
        (candidate) => {
          const searchable = [
            candidate.title,
            candidate.source_name,
            candidate.summary,
            candidate.ai_company,
            candidate.ai_model,
            candidate.ai_category,
            candidate.ai_incident_summary,
            candidate.ai_incident_description,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchable.includes(
            query
          );
        }
      );
    }

    /*
     * Sorting
     */

    result.sort((a, b) => {
      if (
        sortOption === "newest"
      ) {
        return (
          new Date(
            b.discovered_at
          ).getTime() -
          new Date(
            a.discovered_at
          ).getTime()
        );
      }

      if (
        sortOption === "oldest"
      ) {
        return (
          new Date(
            a.discovered_at
          ).getTime() -
          new Date(
            b.discovered_at
          ).getTime()
        );
      }

      if (
        sortOption === "relevance"
      ) {
        return (
          (b.relevance_score ?? 0) -
          (a.relevance_score ?? 0)
        );
      }

      if (
        sortOption === "confidence"
      ) {
        return (
          (b.ai_confidence ?? 0) -
          (a.ai_confidence ?? 0)
        );
      }

      if (
        sortOption === "evidence"
      ) {
        return (
          (b.ai_evidence_quality ??
            0) -
          (a.ai_evidence_quality ??
            0)
        );
      }

      return 0;
    });

    return result;
  }, [
    candidates,
    filter,
    recommendationFilter,
    severityFilter,
    categoryFilter,
    searchQuery,
    sortOption,
  ]);

  /*
   * ------------------------------------------------------------
   * Eligible candidates for batch review
   * ------------------------------------------------------------
   *
   * We allow pending/reviewing candidates to be
   * batch reviewed. Completed AI reviews can also
   * be selected for a deliberate re-run.
   *
   * Accepted/rejected candidates are excluded.
   */

  const eligibleCandidates =
    filteredCandidates.filter(
      (candidate) =>
        candidate.status ===
          "pending" ||
        candidate.status ===
          "reviewing"
    );

  const selectableIds =
    eligibleCandidates
      .filter(
        (candidate) =>
          candidate.ai_review_status !==
          "reviewing"
      )
      .map(
        (candidate) =>
          candidate.id
      );

  const allVisibleSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) =>
      selectedIds.has(id)
    );

  /*
   * ------------------------------------------------------------
   * Selection
   * ------------------------------------------------------------
   */

  function toggleCandidateSelection(
    id: string
  ) {
    setSelectedIds((current) => {
      const next = new Set(
        current
      );

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(
        current
      );

      if (allVisibleSelected) {
        selectableIds.forEach(
          (id) => next.delete(id)
        );
      } else {
        selectableIds.forEach(
          (id) => next.add(id)
        );
      }

      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  /*
   * ------------------------------------------------------------
   * Discovery
   * ------------------------------------------------------------
   */

  async function runDiscovery() {
    setRunningDiscovery(true);
    setDiscoveryMessage("");

    try {
      const response =
        await fetch(
          "/api/discovery/run",
          {
            method: "POST",
          }
        );

      const result =
        await response.json();

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

  async function runNewsDiscovery() {
  setRunningDiscovery(true);
  setDiscoveryMessage("");

  try {
    const response = await fetch(
      "/api/news/discovery/run",
      {
        method: "POST",
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
          "News discovery failed."
      );
    }

    setDiscoveryMessage(
      `News discovery complete — discovered ${result.discovered}, reviewed ${result.reviewed}, published ${result.published}, rejected ${result.rejected}, duplicates ${result.duplicates}, failed ${result.failed}.`
    );
  } catch (error) {
    setDiscoveryMessage(
      error instanceof Error
        ? error.message
        : "News discovery failed."
    );
  } finally {
    setRunningDiscovery(false);
  }
}

  /*
   * ------------------------------------------------------------
   * Individual AI review
   * ------------------------------------------------------------
   */

  async function runAIReview(
    candidate: Candidate
  ) {
    if (
      aiReviewing ||
      batchReviewing
    ) {
      return;
    }

    setAiReviewing(true);

    try {
      let currentCandidate =
        candidate;

      /*
       * If the candidate is still pending,
       * move it into reviewing first.
       */

      if (
        candidate.status ===
        "pending"
      ) {
        const reviewResponse =
          await fetch(
            `/api/admin/candidates/${candidate.id}/review`,
            {
              method: "POST",
            }
          );

        const reviewResult =
          await reviewResponse.json();

        if (!reviewResponse.ok) {
          throw new Error(
            reviewResult.error ||
              "Unable to start candidate review."
          );
        }

        currentCandidate =
          reviewResult.candidate;

        setCandidates((current) =>
          current.map((item) =>
            item.id ===
            candidate.id
              ? currentCandidate
              : item
          )
        );
      }

      /*
       * Ask AI reviewer to analyze
       * the source article.
       */

      const response =
        await fetch(
          `/api/admin/candidates/${candidate.id}/ai-review`,
          {
            method: "POST",
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "AI review failed."
        );
      }

      setCandidates((current) =>
        current.map((item) =>
          item.id ===
          candidate.id
            ? result.candidate
            : item
        )
      );

      const reviewed =
        result.candidate;

      setReviewingCandidate(
        reviewed
      );

      setReviewForm({
        title:
          reviewed.title,

        company:
          reviewed.ai_company ??
          "",

        model:
          reviewed.ai_model ??
          "",

        severity:
          reviewed.ai_severity ??
          "Moderate",

        category:
          reviewed.ai_category ??
          "",

        occurredAt:
          reviewed.published_at
            ? reviewed.published_at.slice(
                0,
                10
              )
            : "",

        summary:
          reviewed.ai_incident_summary ??
          reviewed.summary ??
          "",

        description:
          reviewed.ai_incident_description ??
          reviewed.summary ??
          "",
      });
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "AI review failed."
      );
    } finally {
      setAiReviewing(false);
    }
  }

  /*
   * ------------------------------------------------------------
   * Batch AI review
   * ------------------------------------------------------------
   */

  async function runBatchAIReview() {
    if (
      batchReviewing ||
      aiReviewing
    ) {
      return;
    }

    const ids = Array.from(
      selectedIds
    ).filter((id) =>
      selectableIds.includes(id)
    );

    if (ids.length === 0) {
      alert(
        "Select at least one candidate to review."
      );

      return;
    }

    setBatchReviewing(true);

    setBatchProgress({
      completed: 0,
      failed: 0,
      total: ids.length,
    });

    setBatchMessage("");

    try {
      let completed = 0;
      let failed = 0;

      /*
       * The API accepts a maximum of five
       * candidates per request.
       */

      const batches: string[][] = [];

      for (
        let i = 0;
        i < ids.length;
        i += MAX_BATCH_SIZE
      ) {
        batches.push(
          ids.slice(
            i,
            i + MAX_BATCH_SIZE
          )
        );
      }

      /*
       * Process batches sequentially.
       *
       * Each API request itself processes
       * two Gemini calls concurrently.
       */

      for (
        const batch of batches
      ) {
        const response =
          await fetch(
            "/api/admin/candidates/batch-ai-review",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                candidateIds:
                  batch,
              }),
            }
          );

        const result =
          await response.json();

        if (!response.ok) {
          failed +=
            batch.length;

          setBatchProgress({
            completed,
            failed,
            total: ids.length,
          });

          continue;
        }

        /*
         * Update candidates returned by
         * the backend.
         */

        if (
          Array.isArray(
            result.results
          )
        ) {
          setCandidates(
            (current) => {
              const updated =
                [...current];

              for (
                const batchResult of result.results
              ) {
                if (
                  !batchResult.candidate
                ) {
                  continue;
                }

                const index =
                  updated.findIndex(
                    (candidate) =>
                      candidate.id ===
                      batchResult.id
                  );

                if (
                  index !== -1
                ) {
                  updated[index] =
                    batchResult.candidate;
                }
              }

              return updated;
            }
          );
        }

        completed +=
          result.completed ??
          0;

        failed +=
          result.failed ?? 0;

        setBatchProgress({
          completed,
          failed,
          total: ids.length,
        });
      }

      setBatchMessage(
        `Batch AI review complete — ${completed} completed${
          failed > 0
            ? `, ${failed} failed`
            : ""
        }.`
      );

      clearSelection();
    } catch (error) {
      setBatchMessage(
        error instanceof Error
          ? error.message
          : "Batch AI review failed."
      );
    } finally {
      setBatchReviewing(false);
    }
  }

  /*
   * ------------------------------------------------------------
   * Manual review
   * ------------------------------------------------------------
   */

  async function openReview(
    candidate: Candidate
  ) {
    try {
      let currentCandidate =
        candidate;

      if (
        candidate.status ===
        "pending"
      ) {
        const response =
          await fetch(
            `/api/admin/candidates/${candidate.id}/review`,
            {
              method: "POST",
            }
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Unable to start review."
          );
        }

        currentCandidate =
          result.candidate;

        setCandidates((current) =>
          current.map((item) =>
            item.id ===
            candidate.id
              ? currentCandidate
              : item
          )
        );
      }

      setReviewingCandidate(
        currentCandidate
      );

      setReviewForm({
        title:
          currentCandidate.title,

        company:
          currentCandidate.ai_company ??
          "",

        model:
          currentCandidate.ai_model ??
          "",

        severity:
          currentCandidate.ai_severity ??
          "Moderate",

        category:
          currentCandidate.ai_category ??
          "",

        occurredAt:
          currentCandidate.published_at
            ? currentCandidate.published_at.slice(
                0,
                10
              )
            : "",

        summary:
          currentCandidate.ai_incident_summary ??
          currentCandidate.summary ??
          "",

        description:
          currentCandidate.ai_incident_description ??
          currentCandidate.summary ??
          "",
      });
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to open candidate review."
      );
    }
  }

  function closeReview() {
    if (publishing) {
      return;
    }

    setReviewingCandidate(
      null
    );
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

  /*
   * ------------------------------------------------------------
   * Publish
   * ------------------------------------------------------------
   */

  async function publishIncident(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!reviewingCandidate) {
      return;
    }

    setPublishing(true);

    try {
      const response =
        await fetch(
          `/api/admin/candidates/${reviewingCandidate.id}/publish`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              title:
                reviewForm.title.trim(),

              company:
                reviewForm.company.trim(),

              model:
                reviewForm.model.trim() ||
                null,

              severity:
                reviewForm.severity,

              category:
                reviewForm.category.trim() ||
                null,

              occurredAt:
                reviewForm.occurredAt ||
                null,

              summary:
                reviewForm.summary.trim(),

              description:
                reviewForm.description.trim(),
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to publish incident."
        );
      }

      const updatedCandidate = {
        ...reviewingCandidate,

        status:
          "accepted" as const,

        updated_at:
          new Date().toISOString(),
      };

      setCandidates((current) =>
        current.map((candidate) =>
          candidate.id ===
          reviewingCandidate.id
            ? updatedCandidate
            : candidate
        )
      );

      setPublishing(false);

      setReviewingCandidate(
        null
      );

      alert(
        `Incident "${result.incident.title}" published successfully.`
      );
    } catch (error) {
      setPublishing(false);

      alert(
        error instanceof Error
          ? error.message
          : "Unable to publish incident."
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * Reject
   * ------------------------------------------------------------
   */

  async function rejectCandidate(
    candidate: Candidate
  ) {
    const confirmed =
      window.confirm(
        "Reject this candidate?"
      );

    if (!confirmed) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/admin/candidates/${candidate.id}/reject`,
          {
            method: "POST",
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to reject candidate."
        );
      }

      setCandidates((current) =>
        current.map((item) =>
          item.id ===
          candidate.id
            ? result.candidate
            : item
        )
      );

      setSelectedIds(
        (current) => {
          const next = new Set(
            current
          );

          next.delete(
            candidate.id
          );

          return next;
        }
      );

      if (
        reviewingCandidate?.id ===
        candidate.id
      ) {
        setReviewingCandidate(
          null
        );
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to reject candidate."
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * Delete
   * ------------------------------------------------------------
   */

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

    try {
      const response =
        await fetch(
          `/api/admin/candidates/${id}/delete`,
          {
            method: "DELETE",
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to delete candidate."
        );
      }

      setCandidates((current) =>
        current.filter(
          (candidate) =>
            candidate.id !== id
        )
      );

      setSelectedIds(
        (current) => {
          const next = new Set(
            current
          );

          next.delete(id);

          return next;
        }
      );

      if (
        reviewingCandidate?.id ===
        id
      ) {
        setReviewingCandidate(
          null
        );
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to delete candidate."
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * Render
   * ------------------------------------------------------------
   */

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

        <div className="mb-8 flex flex-wrap gap-2">

          <a
            href="/admin"
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-white"
          >
            Overview
          </a>

          <a
            href="/admin/discovery"
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-white"
          >
            Discovery
          </a>

          <a
            href="/admin/candidates"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Candidates
          </a>

        </div>

        {/* Page heading */}

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
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runningDiscovery
              ? "Scanning..."
              : "Run Incident Discovery"}
          </button>

          <button
            onClick={runNewsDiscovery}
            disabled={runningDiscovery}
            className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runningDiscovery
              ? "Scanning news..."
              : "Run News Discovery"}
          </button>

        </div>

        {discoveryMessage && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {discoveryMessage}
          </div>
        )}

        {/* Stats */}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">

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
            label="AI Reviewed"
            value={counts.aiReviewed}
            color="slate"
          />

          <CandidateStat
            label="AI Recommended"
            value={counts.aiRecommended}
            color="green"
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

        {/* Status filters */}

        <div className="mt-6 flex flex-wrap gap-2">

          {[
            ["pending", "Pending"],
            ["reviewing", "Reviewing"],
            ["ai-reviewed", "AI Reviewed"],
            ["ai-recommended", "AI Recommended"],
            ["accepted", "Accepted"],
            ["rejected", "Rejected"],
            ["all", "All"],
          ].map(
            ([value, label]) => (
              <button
                key={value}
                onClick={() =>
                  setFilter(
                    value as CandidateFilter
                  )
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

        {/* Advanced filters */}

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">

          <div className="grid gap-3 lg:grid-cols-5">

            {/* Search */}

            <div className="lg:col-span-2">

              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Search
              </label>

              <input
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value
                  )
                }
                placeholder="Search titles, companies, models..."
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500"
              />

            </div>

            {/* Recommendation */}

            <div>

              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                AI recommendation
              </label>

              <select
                value={
                  recommendationFilter
                }
                onChange={(event) =>
                  setRecommendationFilter(
                    event.target
                      .value as RecommendationFilter
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="all">
                  All recommendations
                </option>

                <option value="publish">
                  Publish
                </option>

                <option value="review">
                  Review
                </option>

                <option value="reject">
                  Reject
                </option>
              </select>

            </div>

            {/* Severity */}

            <div>

              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Severity
              </label>

              <select
                value={
                  severityFilter
                }
                onChange={(event) =>
                  setSeverityFilter(
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="all">
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

            </div>

            {/* Sort */}

            <div>

              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Sort
              </label>

              <select
                value={sortOption}
                onChange={(event) =>
                  setSortOption(
                    event.target
                      .value as SortOption
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="newest">
                  Newest discovered
                </option>

                <option value="oldest">
                  Oldest discovered
                </option>

                <option value="relevance">
                  Relevance
                </option>

                <option value="confidence">
                  AI confidence
                </option>

                <option value="evidence">
                  Evidence quality
                </option>
              </select>

            </div>

          </div>

          {/* Category */}

          <div className="mt-3 max-w-xs">

            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Category
            </label>

            <select
              value={
                categoryFilter
              }
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            >
              <option value="all">
                All categories
              </option>

              {INCIDENT_CATEGORIES.map(
                (category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                )
              )}

            </select>

          </div>

        </div>

        {/* Batch toolbar */}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-center gap-3">

              <input
                type="checkbox"
                checked={
                  allVisibleSelected
                }
                onChange={
                  toggleSelectAllVisible
                }
                disabled={
                  selectableIds.length ===
                  0
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />

              <div>

                <p className="text-sm font-semibold text-slate-900">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} candidate${
                        selectedIds.size ===
                        1
                          ? ""
                          : "s"
                      } selected`
                    : "Select candidates"}
                </p>

                <p className="text-xs text-slate-400">
                  Select candidates below to run
                  AI review in batches.
                </p>

              </div>

            </div>

            <div className="flex flex-wrap items-center gap-2">

              {selectedIds.size > 0 && (
                <button
                  onClick={
                    clearSelection
                  }
                  disabled={
                    batchReviewing
                  }
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Clear selection
                </button>
              )}

              <button
                onClick={
                  runBatchAIReview
                }
                disabled={
                  batchReviewing ||
                  selectedIds.size ===
                    0
                }
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {batchReviewing
                  ? "Reviewing..."
                  : `AI Review Selected${
                      selectedIds.size >
                      0
                        ? ` (${selectedIds.size})`
                        : ""
                    }`}
              </button>

            </div>

          </div>

          {/* Batch progress */}

          {batchReviewing && (
            <div className="mt-4 border-t border-slate-100 pt-4">

              <div className="flex items-center justify-between text-xs">

                <span className="font-semibold text-slate-700">
                  AI review in progress
                </span>

                <span className="text-slate-400">
                  {
                    batchProgress.completed
                  }{" "}
                  /{" "}
                  {
                    batchProgress.total
                  }{" "}
                  completed
                </span>

              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">

                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{
                    width: `${
                      batchProgress.total >
                      0
                        ? Math.min(
                            100,
                            ((batchProgress.completed +
                              batchProgress.failed) /
                              batchProgress.total) *
                              100
                          )
                        : 0
                    }%`,
                  }}
                />

              </div>

              {batchProgress.failed >
                0 && (
                <p className="mt-2 text-xs text-red-500">
                  {
                    batchProgress.failed
                  }{" "}
                  candidate
                  {batchProgress.failed ===
                  1
                    ? ""
                    : "s"}{" "}
                  failed.
                </p>
              )}

            </div>
          )}

          {batchMessage && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              {batchMessage}
            </div>
          )}

        </div>

        {/* Candidate count */}

        <div className="mt-6 flex items-center justify-between">

          <p className="text-sm text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-700">
              {
                filteredCandidates.length
              }
            </span>{" "}
            candidate
            {filteredCandidates.length ===
            1
              ? ""
              : "s"}
          </p>

          {selectedIds.size >
            0 && (
            <p className="text-xs font-medium text-blue-600">
              {
                selectedIds.size
              }{" "}
              selected
            </p>
          )}

        </div>

        {/* Candidates */}

        <div className="mt-3 space-y-4">

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
                No candidates match these
                filters.
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

                const isSelectable =
                  candidate.status ===
                    "pending" ||
                  candidate.status ===
                    "reviewing";

                const isSelected =
                  selectedIds.has(
                    candidate.id
                  );

                return (
                  <article
                    key={
                      candidate.id
                    }
                    className={`rounded-2xl border bg-white p-6 shadow-sm transition ${
                      isSelected
                        ? "border-blue-400 ring-2 ring-blue-100"
                        : "border-slate-200"
                    }`}
                  >

                    <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">

                      <div className="min-w-0">

                        <div className="flex items-start gap-3">

                          {/* Selection checkbox */}

                          {isSelectable && (
                            <input
                              type="checkbox"
                              checked={
                                isSelected
                              }
                              disabled={
                                candidate.ai_review_status ===
                                "reviewing"
                              }
                              onChange={() =>
                                toggleCandidateSelection(
                                  candidate.id
                                )
                              }
                              className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          )}

                          <div className="min-w-0 flex-1">

                            <div className="flex flex-wrap items-center gap-2">

                              <span
                                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                  statusStyles[
                                    candidate
                                      .status
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

                              {/* AI status */}

                              {candidate.ai_review_status ===
                                "reviewing" && (
                                <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-700">
                                  AI Reviewing
                                </span>
                              )}

                              {candidate.ai_review_status ===
                                "failed" && (
                                <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                                  AI Failed
                                </span>
                              )}

                              {candidate.ai_review_status ===
                                "completed" && (
                                <>
                                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                                    AI{" "}
                                    {
                                      candidate.ai_confidence ??
                                      0
                                    }
                                    %
                                  </span>

                                  {candidate.ai_recommendation ===
                                    "publish" && (
                                    <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                                      AI: Strong
                                    </span>
                                  )}

                                  {candidate.ai_recommendation ===
                                    "review" && (
                                    <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-700">
                                      AI: Review
                                    </span>
                                  )}

                                  {candidate.ai_recommendation ===
                                    "reject" && (
                                    <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                                      AI: Reject
                                    </span>
                                  )}
                                </>
                              )}

                            </div>

                            <h3 className="mt-3 text-lg font-bold text-slate-950">
                              {
                                candidate.title
                              }
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

                            {/* AI metadata */}

                            {candidate.ai_review_status ===
                              "completed" && (
                              <div className="mt-4 flex flex-wrap gap-2">

                                {candidate.ai_severity && (
                                  <span
                                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                      severityStyles[
                                        candidate
                                          .ai_severity
                                      ] ??
                                      "bg-slate-50 text-slate-600 border-slate-200"
                                    }`}
                                  >
                                    {
                                      candidate.ai_severity
                                    }
                                  </span>
                                )}

                                {candidate.ai_category && (
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                                    {
                                      candidate.ai_category
                                    }
                                  </span>
                                )}

                                {candidate.ai_evidence_quality !==
                                  null && (
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                                    Evidence{" "}
                                    {
                                      candidate.ai_evidence_quality
                                    }
                                    %
                                  </span>
                                )}

                              </div>
                            )}

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

                        </div>

                      </div>

                      {/* Actions */}

                      <div className="flex shrink-0 flex-col gap-2 lg:w-40">

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
                          <div className="flex flex-col gap-2">

                            <button
                              onClick={() =>
                                runAIReview(
                                  candidate
                                )
                              }
                              disabled={
                                aiReviewing ||
                                batchReviewing
                              }
                              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {candidate.ai_review_status ===
                              "completed"
                                ? "Re-run AI Review"
                                : candidate.ai_review_status ===
                                  "reviewing"
                                ? "AI Reviewing..."
                                : "AI Review"}
                            </button>

                            <button
                              onClick={() =>
                                openReview(
                                  candidate
                                )
                              }
                              disabled={
                                batchReviewing
                              }
                              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                              Manual Review
                            </button>

                          </div>
                        )}

                        {candidate.status ===
                          "reviewing" && (
                          <button
                            onClick={() =>
                              rejectCandidate(
                                candidate
                              )
                            }
                            disabled={
                              batchReviewing
                            }
                            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
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
                          disabled={
                            batchReviewing
                          }
                          className="rounded-lg px-4 py-2 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50"
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

      {/* -------------------------------------------------------
          Review modal
          ------------------------------------------------------- */}

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
                onClick={
                  closeReview
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>

            </div>

            <form
              onSubmit={
                publishIncident
              }
              className="space-y-5 p-6"
            >

              {/* AI Assessment */}

              {reviewingCandidate.ai_review_status ===
                "completed" && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">

                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
                    Automated AI assessment
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">

                    <div className="text-lg font-bold text-slate-950">
                      {reviewingCandidate.ai_recommendation ===
                      "publish"
                        ? "Strong candidate"
                        : reviewingCandidate.ai_recommendation ===
                          "review"
                        ? "Needs editorial review"
                        : "Likely not an incident"}
                    </div>

                    <div className="flex flex-wrap gap-2">

                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        Confidence:{" "}
                        {
                          reviewingCandidate.ai_confidence ??
                          0
                        }
                        %
                      </span>

                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        Evidence:{" "}
                        {
                          reviewingCandidate.ai_evidence_quality ??
                          0
                        }
                        %
                      </span>

                    </div>

                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">

                    <div>

                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Intended behavior
                      </div>

                      <p className="mt-1 text-sm leading-6 text-slate-700">
                        {reviewingCandidate.ai_intended_behavior ||
                          "Not established from the available evidence."}
                      </p>

                    </div>

                    <div>

                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Observed behavior
                      </div>

                      <p className="mt-1 text-sm leading-6 text-slate-700">
                        {reviewingCandidate.ai_observed_behavior ||
                          "Not established from the available evidence."}
                      </p>

                    </div>

                  </div>

                  <div className="mt-4">

                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Why it may qualify
                    </div>

                    <p className="mt-1 text-sm leading-6 text-slate-700">
                      {reviewingCandidate.ai_scope_violation ||
                        "The AI reviewer could not establish a clear scope violation."}
                    </p>

                  </div>

                  <div className="mt-4">

                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Evidence assessment
                    </div>

                    <p className="mt-1 text-sm leading-6 text-slate-700">
                      {reviewingCandidate.ai_evidence_summary ||
                        "No evidence assessment available."}
                    </p>

                  </div>

                  <div className="mt-4">

                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      AI reasoning
                    </div>

                    <p className="mt-1 text-sm leading-6 text-slate-700">
                      {reviewingCandidate.ai_reasoning ||
                        "No reasoning available."}
                    </p>

                  </div>

                </div>
              )}

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
                  value={
                    reviewForm.title
                  }
                  onChange={(event) =>
                    updateForm(
                      "title",
                      event.target
                        .value
                    )
                  }
                  className="input"
                />
              </Field>

              {/* Company / model */}

              <div className="grid gap-5 sm:grid-cols-2">

                <Field
                  label="Company / organization"
                  required
                >
                  <input
                    required
                    value={
                      reviewForm.company
                    }
                    onChange={(event) =>
                      updateForm(
                        "company",
                        event.target
                          .value
                      )
                    }
                    placeholder="OpenAI"
                    className="input"
                  />
                </Field>

                <Field label="Model">

                  <input
                    value={
                      reviewForm.model
                    }
                    onChange={(event) =>
                      updateForm(
                        "model",
                        event.target
                          .value
                      )
                    }
                    placeholder="GPT-5"
                    className="input"
                  />

                </Field>

              </div>

              {/* Severity / category */}

              <div className="grid gap-5 sm:grid-cols-2">

                <Field
                  label="Severity"
                  required
                >
                  <select
                    value={
                      reviewForm.severity
                    }
                    onChange={(event) =>
                      updateForm(
                        "severity",
                        event.target
                          .value
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
                      value={
                        reviewForm.category
                      }
                      onChange={(event) =>
                        setReviewForm({
                          ...reviewForm,
                          category:
                            event.target
                              .value,
                        })
                      }
                      placeholder="Select or enter a category..."
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
                    />

                    <datalist id="incident-categories">
                      {INCIDENT_CATEGORIES.map(
                        (category) => (
                          <option
                            key={
                              category
                            }
                            value={
                              category
                            }
                          />
                        )
                      )}
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
                      event.target
                        .value
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
                  value={
                    reviewForm.summary
                  }
                  onChange={(event) =>
                    updateForm(
                      "summary",
                      event.target
                        .value
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
                      event.target
                        .value
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
                    disabled={
                      publishing
                    }
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
                    disabled={
                      publishing
                    }
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

/*
 * ------------------------------------------------------------
 * Candidate stat
 * ------------------------------------------------------------
 */

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
    slate:
      "text-slate-950",

    blue:
      "text-blue-600",

    yellow:
      "text-yellow-600",

    green:
      "text-green-600",
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

/*
 * ------------------------------------------------------------
 * Form field
 * ------------------------------------------------------------
 */

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