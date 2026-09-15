"use client";

import { useMemo, useState } from "react";
import type { Database } from "../../database.types";

type Candidate =
  Database["public"]["Tables"]["ai_news_candidates"]["Row"];

type Props = {
  initialCandidates: Candidate[];
  userEmail: string;
};

type StatusFilter =
  | "all"
  | "pending"
  | "reviewing"
  | "published"
  | "accepted"
  | "rejected"
  | "duplicate"
  | "failed";

type SortOption =
  | "discovered_newest"
  | "discovered_oldest"
  | "published_newest"
  | "published_oldest"
  | "relevance";

const statusStyles: Record<string, string> = {
  pending: "bg-blue-50 text-blue-700 border-blue-200",
  reviewing: "bg-yellow-50 text-yellow-700 border-yellow-200",
  published: "bg-green-50 text-green-700 border-green-200",
  accepted: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-slate-100 text-slate-500 border-slate-200",
  duplicate: "bg-purple-50 text-purple-700 border-purple-200",
  converted_to_incident: "bg-purple-50 text-purple-700 border-purple-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "reviewing", label: "Reviewing" },
  { value: "published", label: "Published" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "duplicate", label: "Duplicate" },
  { value: "failed", label: "Failed" },
  { value: "all", label: "All" },
];

export default function NewsCandidatesDashboard({
  initialCandidates,
  userEmail,
}: Props) {
  const [candidates, setCandidates] =
    useState<Candidate[]>(initialCandidates);

  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortOption, setSortOption] = useState<SortOption>(
    "discovered_newest"
  );

  const [actionId, setActionId] = useState<string | null>(null);
  const [runningDiscovery, setRunningDiscovery] = useState(false);
  const [discoveryMessage, setDiscoveryMessage] = useState<string | null>(
    null
  );

  const counts = useMemo(() => {
    const result = {
      all: candidates.length,
      pending: 0,
      reviewing: 0,
      published: 0,
      accepted: 0,
      rejected: 0,
      duplicate: 0,
      failed: 0,
    };

    for (const candidate of candidates) {
      if (candidate.status in result) {
        (result as Record<string, number>)[candidate.status] += 1;
      }
    }

    return result;
  }, [candidates]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const candidate of candidates) {
      if (candidate.ai_category) {
        set.add(candidate.ai_category);
      }
    }
    return Array.from(set).sort();
  }, [candidates]);

  const visibleCandidates = useMemo(() => {
    let result =
      filter === "all"
        ? candidates
        : candidates.filter((c) => c.status === filter);

    if (categoryFilter !== "all") {
      result = result.filter((c) => c.ai_category === categoryFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.title?.toLowerCase().includes(q) ||
          c.ai_title?.toLowerCase().includes(q) ||
          c.source_name?.toLowerCase().includes(q) ||
          c.ai_company?.toLowerCase().includes(q)
      );
    }

    const sorted = [...result];

    if (sortOption === "discovered_newest") {
      sorted.sort(
        (a, b) =>
          new Date(b.discovered_at).getTime() -
          new Date(a.discovered_at).getTime()
      );
    } else if (sortOption === "discovered_oldest") {
      sorted.sort(
        (a, b) =>
          new Date(a.discovered_at).getTime() -
          new Date(b.discovered_at).getTime()
      );
    } else if (sortOption === "published_newest") {
      sorted.sort((a, b) => {
        if (!a.published_at && !b.published_at) return 0;
        if (!a.published_at) return 1;
        if (!b.published_at) return -1;
        return (
          new Date(b.published_at).getTime() -
          new Date(a.published_at).getTime()
        );
      });
    } else if (sortOption === "published_oldest") {
      sorted.sort((a, b) => {
        if (!a.published_at && !b.published_at) return 0;
        if (!a.published_at) return 1;
        if (!b.published_at) return -1;
        return (
          new Date(a.published_at).getTime() -
          new Date(b.published_at).getTime()
        );
      });
    } else if (sortOption === "relevance") {
      sorted.sort(
        (a, b) =>
          (b.ai_relevance_score ?? b.relevance_score ?? 0) -
          (a.ai_relevance_score ?? a.relevance_score ?? 0)
      );
    }

    return sorted;
  }, [candidates, filter, categoryFilter, searchQuery, sortOption]);

  function updateCandidate(id: string, patch: Partial<Candidate>) {
    setCandidates((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      )
    );
  }

  async function handleRunDiscovery() {
    setRunningDiscovery(true);
    setDiscoveryMessage(null);

    try {
      const res = await fetch("/api/news/discover", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Discovery failed.");
      }

      setDiscoveryMessage(
        `Discovered ${data.discovered ?? 0} articles — ${
          data.candidates_inserted ?? 0
        } new, ${data.reviewed ?? 0} reviewed, ${
          data.published ?? 0
        } published, ${data.rejected ?? 0} rejected, ${
          data.duplicate_articles ?? 0
        } duplicate coverage skipped, ${
          data.duplicates ?? 0
        } duplicate URLs${data.failed ? `, ${data.failed} failed` : ""}.`
      );

      window.location.reload();
    } catch (err) {
      setDiscoveryMessage(
        err instanceof Error ? err.message : "Discovery failed."
      );
    } finally {
      setRunningDiscovery(false);
    }
  }

  async function handleAiReview(id: string) {
    setActionId(id);
    try {
      const res = await fetch(
        `/api/admin/news-candidates/${id}/ai-review`,
        { method: "POST" }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "AI review failed.");
      }

      updateCandidate(id, data.candidate);
    } catch (err) {
      console.error("AI review error:", err);
      alert(err instanceof Error ? err.message : "AI review failed.");
    } finally {
      setActionId(null);
    }
  }

  async function handlePublish(id: string, force: boolean) {
    if (force) {
      const confirmed = window.confirm(
        "This article hasn't been AI reviewed yet. Publish it to the AI News page anyway?"
      );
      if (!confirmed) {
        return;
      }
    }

    setActionId(id);
    try {
      const res = await fetch(
        `/api/admin/news-candidates/${id}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force }),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Publish failed.");
      }

      updateCandidate(id, { status: "accepted" });
    } catch (err) {
      console.error("Publish error:", err);
      alert(err instanceof Error ? err.message : "Publish failed.");
    } finally {
      setActionId(null);
    }
  }

  async function handlePublishAsIncident(id: string) {
    const severity = window.prompt(
      "Severity for this incident (e.g. Critical, High, Moderate, Low):"
    );

    if (!severity) {
      return;
    }

    setActionId(id);
    try {
      const res = await fetch(
        `/api/admin/news-candidates/${id}/publish-as-incident`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ severity }),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Publish as incident failed.");
      }

      updateCandidate(id, { status: "converted_to_incident" });
    } catch (err) {
      console.error("Publish as incident error:", err);
      alert(
        err instanceof Error ? err.message : "Publish as incident failed."
      );
    } finally {
      setActionId(null);
    }
  }

  async function handleReject(id: string) {
    setActionId(id);
    try {
      const res = await fetch(
        `/api/admin/news-candidates/${id}/reject`,
        { method: "POST" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Reject failed.");
      }

      updateCandidate(id, { status: "rejected" });
    } catch (err) {
      console.error("Reject error:", err);
      alert(err instanceof Error ? err.message : "Reject failed.");
    } finally {
      setActionId(null);
    }
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

            <form action="/api/admin/logout" method="post">
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
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-white"
          >
            Candidates
          </a>

          <a
            href="/admin/news-candidates"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            News Candidates
          </a>

        </div>

        {/* Page heading */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

          <div>
            <h2 className="text-2xl font-bold text-slate-950">
              AI news candidates
            </h2>

            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Articles discovered by Frontier that may be worth
              publishing to the AI News page.
            </p>
          </div>

          <button
            onClick={handleRunDiscovery}
            disabled={runningDiscovery}
            className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runningDiscovery ? "Scanning news..." : "Run News Discovery"}
          </button>

        </div>

        {discoveryMessage && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {discoveryMessage}
          </div>
        )}

        {/* Stats */}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-8">
          <CandidateStat label="All" value={counts.all} />
          <CandidateStat label="Pending" value={counts.pending} color="blue" />
          <CandidateStat label="Reviewing" value={counts.reviewing} color="yellow" />
          <CandidateStat label="Published" value={counts.published} color="green" />
          <CandidateStat label="Accepted" value={counts.accepted} color="green" />
          <CandidateStat label="Rejected" value={counts.rejected} />
          <CandidateStat label="Duplicate" value={counts.duplicate} />
          <CandidateStat label="Failed" value={counts.failed} />
        </div>

        {/* Status filters */}

        <div className="mt-6 flex flex-wrap gap-2">
          {STATUS_FILTERS.map(({ value, label }) => (
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

        {/* Advanced filters */}

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 lg:grid-cols-4">

            <div className="lg:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Search
              </label>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search titles, sources, companies..."
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Sort
              </label>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="discovered_newest">Newest discovered</option>
                <option value="discovered_oldest">Oldest discovered</option>
                <option value="published_newest">Newest published</option>
                <option value="published_oldest">Oldest published</option>
                <option value="relevance">Relevance</option>
              </select>
            </div>

          </div>
        </div>

        {/* Candidates */}

        <div className="mt-6 space-y-4">

          {visibleCandidates.length === 0 ? (

            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
              <div className="text-3xl">✓</div>
              <h3 className="mt-4 font-semibold text-slate-900">
                Nothing here
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                No candidates match these filters.
              </p>
            </div>

          ) : (

            visibleCandidates.map((item) => {
              const isNew =
                Date.now() -
                  new Date(item.discovered_at).getTime() <
                24 * 60 * 60 * 1000;

              const needsAiReview = item.ai_review_status !== "completed";

              const canPublish =
                item.status !== "accepted" &&
                item.status !== "rejected";

              const isReviewedAndRelevant =
                item.ai_review_status === "completed" &&
                item.ai_is_relevant === true;

              const score = item.ai_relevance_score ?? item.relevance_score;

              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">

                    <div className="min-w-0 flex-1">

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            statusStyles[item.status] ?? statusStyles.pending
                          }`}
                        >
                          {item.status}
                        </span>

                        {isNew && (
                          <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
                            NEW
                          </span>
                        )}

                        {score != null && (
                          <span className="text-xs font-medium text-slate-400">
                            Relevance {score}/100
                          </span>
                        )}

                        {item.ai_review_status === "reviewing" && (
                          <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-700">
                            AI Reviewing
                          </span>
                        )}

                        {item.ai_review_status === "failed" && (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                            AI Failed
                          </span>
                        )}

                        {item.ai_review_status === "completed" && (
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              item.ai_is_relevant
                                ? "border-green-200 bg-green-50 text-green-700"
                                : "border-red-200 bg-red-50 text-red-700"
                            }`}
                          >
                            {item.ai_is_relevant
                              ? "AI: Relevant"
                              : "AI: Not relevant"}
                          </span>
                        )}
                      </div>

                      <a
                        href={item.article_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 block text-lg font-bold text-slate-950 hover:text-blue-600"
                      >
                        {item.ai_title || item.title || "Untitled Article"}
                      </a>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                        {item.source_name && <span>{item.source_name}</span>}

                        <span>
                          Discovered{" "}
                          {new Date(item.discovered_at).toLocaleString()}
                        </span>

                        {item.published_at && (
                          <span>
                            Published{" "}
                            {new Date(item.published_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {item.ai_review_status === "completed" && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {item.ai_category && (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                              {item.ai_category}
                            </span>
                          )}

                          {item.ai_company && (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                              {item.ai_company}
                            </span>
                          )}

                          {item.ai_importance && (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                              {item.ai_importance} importance
                            </span>
                          )}
                        </div>
                      )}

                      <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
                        {item.ai_summary ||
                          item.summary ||
                          "No summary available."}
                      </p>

                      {item.matched_keywords &&
                        item.matched_keywords.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {item.matched_keywords.map((keyword) => (
                              <span
                                key={keyword}
                                className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500"
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        )}

                    </div>

                    {/* Actions */}

                    <div className="flex shrink-0 flex-col gap-2 lg:w-44">

                      <a
                        href={item.article_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Read source ↗
                      </a>

                      {needsAiReview && item.status !== "accepted" && (
                        <button
                          onClick={() => handleAiReview(item.id)}
                          disabled={actionId === item.id}
                          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actionId === item.id
                            ? "Reviewing..."
                            : "Run AI Review"}
                        </button>
                      )}

                      {canPublish && (
                        <button
                          onClick={() =>
                            handlePublish(item.id, !isReviewedAndRelevant)
                          }
                          disabled={actionId === item.id}
                          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            isReviewedAndRelevant
                              ? "bg-blue-600 hover:bg-blue-500"
                              : "bg-amber-600 hover:bg-amber-500"
                          }`}
                        >
                          {actionId === item.id
                            ? "Publishing..."
                            : isReviewedAndRelevant
                            ? "Approve & Publish"
                            : "Publish without review"}
                        </button>
                      )}

                      {item.status !== "accepted" &&
                        item.status !== "rejected" &&
                        item.status !== "converted_to_incident" && (
                          <button
                            onClick={() => handlePublishAsIncident(item.id)}
                            disabled={actionId === item.id}
                            className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                          >
                            Publish as Incident
                          </button>
                        )}

                      {item.status !== "accepted" &&
                        item.status !== "rejected" && (
                          <button
                            onClick={() => handleReject(item.id)}
                            disabled={actionId === item.id}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        )}

                    </div>

                  </div>
                </article>
              );
            })

          )}

        </div>

      </main>

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
  color?: "slate" | "blue" | "yellow" | "green";
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
      <p className={`mt-1 text-2xl font-bold ${colors[color]}`}>{value}</p>
    </div>
  );
}
