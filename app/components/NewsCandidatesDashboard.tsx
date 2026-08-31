"use client";

import {
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import type { Database } from "../../database.types";

type NewsCandidate =
  Database["public"]["Tables"]["ai_news_candidates"]["Row"];

type Props = {
  initialCandidates: NewsCandidate[];
  userEmail: string;
};

type Filter =
  | "all"
  | "pending"
  | "reviewing"
  | "published"
  | "rejected"
  | "failed";

const statusStyles: Record<
  string,
  string
> = {
  pending:
    "border-blue-200 bg-blue-50 text-blue-700",

  reviewing:
    "border-yellow-200 bg-yellow-50 text-yellow-700",

  published:
    "border-green-200 bg-green-50 text-green-700",

  rejected:
    "border-slate-200 bg-slate-100 text-slate-500",

  failed:
    "border-red-200 bg-red-50 text-red-700",
};

function formatDate(
  value: string | null
) {
  if (!value) {
    return "Unknown date";
  }

  return new Date(
    value
  ).toLocaleString();
}

function getStatusLabel(
  status: string
) {
  switch (status) {
    case "pending":
      return "Pending";

    case "reviewing":
      return "Reviewing";

    case "published":
      return "Published";

    case "rejected":
      return "Rejected";

    case "failed":
      return "Failed";

    default:
      return status;
  }
}

export default function NewsCandidatesDashboard({
  initialCandidates,
  userEmail,
}: Props) {
  const [
    candidates,
    setCandidates,
  ] = useState<
    NewsCandidate[]
  >(initialCandidates);

  const [
    filter,
    setFilter,
  ] = useState<Filter>(
    "all"
  );

  const [
    isDiscovering,
    setIsDiscovering,
  ] = useState(false);

  const [
    discoveryMessage,
    setDiscoveryMessage,
  ] = useState<
    string | null
  >(null);

  const [
    expandedId,
    setExpandedId,
  ] = useState<
    string | null
  >(null);

  const filteredCandidates =
    useMemo(() => {
      if (filter === "all") {
        return candidates;
      }

      return candidates.filter(
        (candidate) =>
          candidate.status ===
          filter
      );
    }, [
      candidates,
      filter,
    ]);

  const counts = useMemo(() => {
    return {
      all:
        candidates.length,

      pending:
        candidates.filter(
          (c) =>
            c.status ===
            "pending"
        ).length,

      reviewing:
        candidates.filter(
          (c) =>
            c.status ===
            "reviewing"
        ).length,

      published:
        candidates.filter(
          (c) =>
            c.status ===
            "published"
        ).length,

      rejected:
        candidates.filter(
          (c) =>
            c.status ===
            "rejected"
        ).length,

      failed:
        candidates.filter(
          (c) =>
            c.status ===
            "failed"
        ).length,
    };
  }, [candidates]);

  async function runDiscovery() {
    setIsDiscovering(true);
    setDiscoveryMessage(
      "Running AI news discovery..."
    );

    try {
      const response =
        await fetch(
          "/api/news/discover",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "News discovery failed."
        );
      }

      setDiscoveryMessage(
        `Discovery complete — found ${data.discovered ?? 0}, added ${data.candidates_inserted ?? 0} new candidates, reviewed ${data.reviewed ?? 0}, and published ${data.published ?? 0}.`
      );

      /*
       * Refresh the page so the latest
       * candidates appear immediately.
       */
      window.location.reload();
    } catch (error) {
      setDiscoveryMessage(
        error instanceof Error
          ? error.message
          : "News discovery failed."
      );
    } finally {
      setIsDiscovering(false);
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
              News Candidates
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

      <main className="mx-auto max-w-7xl px-6 py-8">

        {/* Navigation */}

        <nav className="mb-8 flex gap-2 overflow-x-auto">

          <NavLink href="/admin">
            Overview
          </NavLink>

          <NavLink href="/admin/incidents">
            Incidents
          </NavLink>

          <NavLink href="/admin/candidates">
            Incident Candidates
          </NavLink>

          <NavLink
            href="/admin/news-candidates"
            active
          >
            News Candidates
          </NavLink>

          <NavLink href="/admin/discovery">
            Discovery
          </NavLink>

        </nav>

        {/* Title */}

        <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">

          <div>

            <div className="mb-3 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
              AI News Pipeline
            </div>

            <h2 className="text-3xl font-bold tracking-tight text-slate-950">
              News discovery
            </h2>

            <p className="mt-2 max-w-2xl text-slate-500">
              Articles discovered by Frontier&apos;s
              news scraper and evaluated by the AI
              editorial reviewer.
            </p>

          </div>

          <button
            type="button"
            onClick={runDiscovery}
            disabled={
              isDiscovering
            }
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDiscovering
              ? "Discovering..."
              : "Run News Discovery"}
          </button>

        </div>

        {/* Discovery message */}

        {discoveryMessage && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {discoveryMessage}
          </div>
        )}

        {/* Stats */}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">

          <Stat
            label="Total"
            value={counts.all}
          />

          <Stat
            label="Pending"
            value={counts.pending}
            color="blue"
          />

          <Stat
            label="Reviewing"
            value={counts.reviewing}
            color="yellow"
          />

          <Stat
            label="Published"
            value={counts.published}
            color="green"
          />

          <Stat
            label="Rejected"
            value={counts.rejected}
            color="slate"
          />

          <Stat
            label="Failed"
            value={counts.failed}
            color="red"
          />

        </section>

        {/* Filters */}

        <div className="mb-5 flex flex-wrap gap-2">

          {(
            [
              "all",
              "pending",
              "reviewing",
              "published",
              "rejected",
              "failed",
            ] as Filter[]
          ).map(
            (option) => (
              <button
                key={option}
                type="button"
                onClick={() =>
                  setFilter(
                    option
                  )
                }
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  filter ===
                  option
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {option ===
                "all"
                  ? "All"
                  : getStatusLabel(
                      option
                    )}

                <span className="ml-2 opacity-60">
                  {
                    counts[
                      option
                    ]
                  }
                </span>
              </button>
            )
          )}

        </div>

        {/* Candidates */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

          {filteredCandidates.length ===
          0 ? (

            <div className="px-6 py-16 text-center">

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-xl text-blue-600">
                +
              </div>

              <h3 className="mt-4 font-semibold text-slate-950">
                No news candidates
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Run news discovery to find
                new AI stories.
              </p>

            </div>

          ) : (

            <div className="divide-y divide-slate-100">

              {filteredCandidates.map(
                (candidate) => {

                  const expanded =
                    expandedId ===
                    candidate.id;

                  const score =
                    candidate.ai_relevance_score ??
                    candidate.relevance_score;

                  return (
                    <article
                      key={
                        candidate.id
                      }
                      className="p-6"
                    >

                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

                        <div className="min-w-0 flex-1">

                          <div className="mb-3 flex flex-wrap items-center gap-2">

                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                statusStyles[
                                  candidate
                                    .status
                                ] ??
                                "border-slate-200 bg-slate-50 text-slate-600"
                              }`}
                            >
                              {getStatusLabel(
                                candidate.status
                              )}
                            </span>

                            {candidate.ai_importance && (
                              <span className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
                                {
                                  candidate.ai_importance
                                }{" "}
                                importance
                              </span>
                            )}

                            {candidate.ai_category && (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                                {
                                  candidate.ai_category
                                }
                              </span>
                            )}

                          </div>

                          <h3 className="text-xl font-bold tracking-tight text-slate-950">
                            {candidate.ai_title ||
                              candidate.title}
                          </h3>

                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">

                            <span>
                              {
                                candidate.source_name
                              }
                            </span>

                            <span>
                              {formatDate(
                                candidate.published_at ||
                                  candidate.discovered_at
                              )}
                            </span>

                            {score !==
                              null &&
                              score !==
                                undefined && (
                                <span className="font-semibold text-blue-600">
                                  AI score:{" "}
                                  {score}
                                </span>
                              )}

                          </div>

                          <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-600">
                            {candidate.ai_summary ||
                              candidate.summary ||
                              "No summary available."}
                          </p>

                          {candidate.ai_company && (
                            <p className="mt-3 text-sm text-slate-500">
                              Company:{" "}
                              <span className="font-medium text-slate-700">
                                {
                                  candidate.ai_company
                                }
                              </span>
                            </p>
                          )}

                          {candidate.ai_model && (
                            <p className="mt-1 text-sm text-slate-500">
                              Model:{" "}
                              <span className="font-medium text-slate-700">
                                {
                                  candidate.ai_model
                                }
                              </span>
                            </p>
                          )}

                          <div className="mt-5 flex flex-wrap gap-3">

                            <a
                              href={
                                candidate.article_url
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                            >
                              Read Article →
                            </a>

                            <button
                              type="button"
                              onClick={() =>
                                setExpandedId(
                                  expanded
                                    ? null
                                    : candidate.id
                                )
                              }
                              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              {expanded
                                ? "Hide Details"
                                : "View Details"}
                            </button>

                          </div>

                        </div>

                      </div>

                      {expanded && (
                        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">

                          <div className="grid gap-5 md:grid-cols-2">

                            <Detail
                              label="Source URL"
                              value={
                                candidate.source_url
                              }
                            />

                            <Detail
                              label="Article URL"
                              value={
                                candidate.article_url
                              }
                            />

                            <Detail
                              label="Discovery relevance"
                              value={
                                candidate.relevance_score !==
                                null
                                  ? String(
                                      candidate.relevance_score
                                    )
                                  : "—"
                              }
                            />

                            <Detail
                              label="Article text"
                              value={`${candidate.article_text_length} characters`}
                            />

                            <Detail
                              label="Fetch status"
                              value={
                                candidate.article_fetch_status
                              }
                            />

                            <Detail
                              label="AI reviewed"
                              value={
                                candidate.ai_reviewed_at
                                  ? formatDate(
                                      candidate.ai_reviewed_at
                                    )
                                  : "Not reviewed"
                              }
                            />

                          </div>

                          {candidate.ai_reasoning && (
                            <div className="mt-5">

                              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                AI reasoning
                              </p>

                              <p className="mt-2 text-sm leading-6 text-slate-600">
                                {
                                  candidate.ai_reasoning
                                }
                              </p>

                            </div>
                          )}

                          {candidate.article_text && (
                            <div className="mt-5">

                              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Retrieved article text
                              </p>

                              <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                {
                                  candidate.article_text
                                }
                              </p>

                            </div>
                          )}

                        </div>
                      )}

                    </article>
                  );
                }
              )}

            </div>

          )}

        </section>

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

function Stat({
  label,
  value,
  color = "blue",
}: {
  label: string;
  value: number;
  color?:
    | "blue"
    | "yellow"
    | "green"
    | "slate"
    | "red";
}) {
  const colors = {
    blue: "text-blue-600",
    yellow: "text-yellow-600",
    green: "text-emerald-600",
    slate: "text-slate-500",
    red: "text-red-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

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

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-all text-sm text-slate-700">
        {value}
      </p>
    </div>
  );
}