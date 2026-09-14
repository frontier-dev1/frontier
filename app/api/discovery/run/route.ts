import { NextResponse } from "next/server";

import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

import {
  discoverCandidates,
  fetchArticleContent,
} from "../../../../lib/discovery/scraper";

import { reviewCandidate } from "../../../../lib/ai/reviewer";
import { findBestMatch } from "../../../../lib/duplicate-detection";

export const dynamic = "force-dynamic";

/*
 * Vercel Hobby caps Serverless Function duration at 60s. We stop
 * processing well before that so the platform never kills the
 * request mid-write and leaves a candidate in a half-updated state.
 */
export const maxDuration = 60;

const TIME_BUDGET_MS = 45_000;

/*
 * An incident candidate is only auto-published when the AI is this
 * confident AND explicitly recommends publishing. Anything less
 * (including every "review" recommendation) is left for a human,
 * because incidents name real companies and products — a wrong
 * auto-publish here is a very different kind of mistake than a
 * miscategorized news article.
 */
const MIN_AUTO_PUBLISH_CONFIDENCE = 80;

/*
 * How similar two incidents' summaries need to be (same company)
 * to treat them as the same underlying event rather than two
 * separate incidents.
 */
const DUPLICATE_SIMILARITY_THRESHOLD = 0.35;

export async function POST(
  request: Request
) {
  return runDiscovery(request);
}

export async function GET(
  request: Request
) {
  /*
   * Vercel Cron Jobs always send a GET request and automatically
   * attach `Authorization: Bearer $CRON_SECRET` if that env var is
   * set on the project — this is what lets the schedule in
   * vercel.json trigger this route without a logged-in admin.
   */
  return runDiscovery(request);
}

async function runDiscovery(
  request: Request
) {
  const cronSecret =
    process.env.FRONTIER_CRON_SECRET;

  const vercelCronSecret =
    process.env.CRON_SECRET;

  /*
   * ----------------------------------------------------------
   * 1. Authentication
   * ----------------------------------------------------------
   *
   * Automated GitHub/Vercel requests may use the cron secret.
   * Manual requests must come from a logged-in admin.
   */

  const authorization =
    request.headers.get("authorization");

  const providedSecret =
    authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

  const isAutomatedRequest =
    Boolean(
      providedSecret &&
        ((cronSecret &&
          providedSecret === cronSecret) ||
          (vercelCronSecret &&
            providedSecret === vercelCronSecret))
    );

  if (!isAutomatedRequest) {
    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: admin,
      error: adminError,
    } =
      await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (adminError) {
      console.error(
        "Admin verification failed:",
        adminError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify administrator access.",
        },
        {
          status: 500,
        }
      );
    }

    if (!admin) {
      return NextResponse.json(
        {
          error: "Forbidden",
        },
        {
          status: 403,
        }
      );
    }
  }

  /*
   * ----------------------------------------------------------
   * 2. Create service-role Supabase client
   * ----------------------------------------------------------
   */

  const adminSupabase =
    createAdminClient();

  let discoveryRunId:
    | string
    | null = null;

  const startedAt =
    new Date().toISOString();

  /*
   * ----------------------------------------------------------
   * 3. Create discovery run record
   * ----------------------------------------------------------
   */

  try {
    const {
      data: run,
      error,
    } =
      await adminSupabase
        .from("discovery_runs")
        .insert({
          started_at: startedAt,
          status: "running",
        })
        .select("id")
        .single();

    if (error) {
      console.error(
        "Failed to create discovery run:",
        error
      );
    } else {
      discoveryRunId = run.id;
    }
  } catch (error) {
    console.error(
      "Discovery run logging failed:",
      error
    );
  }

  /*
   * ----------------------------------------------------------
   * 4. Run discovery
   * ----------------------------------------------------------
   */

  try {
    console.log(
      "Frontier discovery started."
    );

    const candidates =
      await discoverCandidates();

    let inserted = 0;

    let duplicates = 0;

    /*
     * --------------------------------------------------------
     * 5. Save every discovered candidate
     * --------------------------------------------------------
     */

    for (
      const candidate of candidates
    ) {
      /*
       * Log useful information during development.
       */

      console.log(
        [
          "Candidate:",
          candidate.title,
          "|",
          "URL:",
          candidate.article_url,
          "|",
          "Resolved:",
          candidate.source_url,
          "|",
          "Article text:",
          candidate.article_text_length,
          "chars",
          "|",
          "Status:",
          candidate.article_fetch_status,
        ].join(" ")
      );

      /*
       * ------------------------------------------------------
       * Insert candidate.
       *
       * article_url is unique, so existing candidates are
       * ignored rather than overwritten.
       *
       * This is intentional.
       * ------------------------------------------------------
       */

      const {
        data,
        error,
      } =
        await adminSupabase
          .from("incident_candidates")
          .upsert(
            {
              id:
                candidate.id,

              title:
                candidate.title,

              source_name:
                candidate.source_name,

              source_url:
                candidate.source_url,

              article_url:
                candidate.article_url,

              summary:
                candidate.summary,

              published_at:
                candidate.published_at,

              discovered_at:
                candidate.discovered_at,

              status:
                "pending",

              relevance_score:
                candidate.relevance_score,

              matched_keywords:
                candidate.matched_keywords,

              notes:
                candidate.notes,

              article_text:
                candidate.article_text,

              article_text_source:
                candidate.article_text_source,

              article_text_fetched_at:
                candidate.article_text_fetched_at,

              article_text_length:
                candidate.article_text_length,

              article_fetch_status:
                candidate.article_fetch_status,

              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict:
                "article_url",

              ignoreDuplicates:
                true,
            }
          )
          .select("id");

      if (error) {
        console.error(
          "Candidate insert error:",
          error
        );

        continue;
      }

      if (
        data &&
        data.length > 0
      ) {
        inserted++;
      } else {
        duplicates++;
      }
    }

    /*
     * ----------------------------------------------------------
     * 5.5. Batch review + auto-decide
     * ----------------------------------------------------------
     *
     * Discovery above only inserts bare candidates (title, url,
     * summary) — fast, since it's just RSS parsing. Fetching full
     * article text and running it through Gemini happens here,
     * one candidate at a time, until we're close to the function's
     * time limit. This keeps a single invocation safe on Vercel
     * Hobby regardless of how many candidates are queued up.
     */

    const reviewStartedAt = Date.now();

    let reviewed = 0;

    let autoPublished = 0;

    let duplicatesMerged = 0;

    let autoRejected = 0;

    let leftForHuman = 0;

    let reviewFailed = 0;

    while (
      Date.now() - reviewStartedAt <
      TIME_BUDGET_MS
    ) {
      const {
        data: pending,
        error: pendingError,
      } = await adminSupabase
        .from("incident_candidates")
        .select("*")
        .eq("status", "pending")
        .order("relevance_score", {
          ascending: false,
        })
        .limit(1);

      if (pendingError) {
        console.error(
          "Failed to load pending candidate:",
          pendingError
        );
        break;
      }

      const next = pending?.[0];

      if (!next) {
        break;
      }

      try {
        // Mark as reviewing so a second concurrent run (or a
        // human clicking "Run AI Review") doesn't double-process it.
        await adminSupabase
          .from("incident_candidates")
          .update({
            status: "reviewing",
            ai_review_status: "reviewing",
            updated_at: new Date().toISOString(),
          })
          .eq("id", next.id);

        // Fetch full article content now, since discovery deferred it.
        const articleContent =
          await fetchArticleContent(
            next.article_url,
            next.summary
          );

        await adminSupabase
          .from("incident_candidates")
          .update({
            article_text: articleContent.text,
            article_text_source: articleContent.source,
            article_text_fetched_at: new Date().toISOString(),
            article_text_length:
              articleContent.text?.length ?? 0,
            article_fetch_status: articleContent.status,
          })
          .eq("id", next.id);

        const result = await reviewCandidate({
          title: next.title,
          sourceName: next.source_name,
          sourceUrl: next.source_url,
          articleUrl: next.article_url,
          summary: next.summary,
          publishedAt: next.published_at,
          articleText: articleContent.text,
        });

        reviewed++;

        await adminSupabase
          .from("incident_candidates")
          .update({
            ai_review_status: "completed",
            ai_reviewed_at: new Date().toISOString(),
            ai_is_incident: result.is_incident,
            ai_confidence: result.confidence,
            ai_recommendation: result.recommendation,
            ai_company: result.company,
            ai_model: result.model,
            ai_category: result.category,
            ai_severity: result.severity,
            ai_incident_summary: result.incident_summary,
            ai_incident_description: result.incident_description,
            ai_intended_behavior: result.intended_behavior,
            ai_observed_behavior: result.observed_behavior,
            ai_scope_violation: result.scope_violation,
            ai_evidence_summary: result.evidence_summary,
            ai_evidence_quality: result.evidence_quality,
            ai_reasoning: result.reasoning,
            ai_additional_sources: result.additional_sources,
            updated_at: new Date().toISOString(),
          })
          .eq("id", next.id);

        /*
         * ------------------------------------------------------
         * Auto-decide
         * ------------------------------------------------------
         */

        const requiredFieldsPresent = Boolean(
          result.company &&
            result.severity &&
            result.incident_summary &&
            result.incident_description
        );

        if (
          !result.is_incident ||
          result.recommendation === "reject"
        ) {
          await adminSupabase
            .from("incident_candidates")
            .update({
              status: "rejected",
              updated_at: new Date().toISOString(),
            })
            .eq("id", next.id);

          autoRejected++;
        } else if (
          result.recommendation === "publish" &&
          result.confidence >= MIN_AUTO_PUBLISH_CONFIDENCE &&
          requiredFieldsPresent
        ) {
          /*
           * --------------------------------------------------
           * Duplicate check
           * --------------------------------------------------
           *
           * Different publishers often cover the same incident.
           * Before creating a new incident, check whether an
           * existing one from the same company already describes
           * the same event. If so, attach this article as an
           * additional source instead of publishing a duplicate.
           */

          const { data: sameCompanyIncidents } =
            await adminSupabase
              .from("incidents")
              .select(
                "id, title, summary, description, additional_sources"
              )
              .ilike("company", result.company as string)
              .order("created_at", { ascending: false })
              .limit(15);

          const duplicateMatch = findBestMatch(
            `${result.incident_summary} ${result.incident_description}`,
            sameCompanyIncidents ?? [],
            (incident) =>
              `${incident.summary} ${incident.description}`,
            DUPLICATE_SIMILARITY_THRESHOLD
          );

          if (duplicateMatch) {
            const existingSources = Array.isArray(
              duplicateMatch.item.additional_sources
            )
              ? duplicateMatch.item.additional_sources
              : [];

            await adminSupabase
              .from("incidents")
              .update({
                additional_sources: [
                  ...existingSources,
                  {
                    url: next.article_url,
                    source_name: next.source_name,
                    title: next.title,
                  },
                ],
                updated_at_timestamp:
                  new Date().toISOString(),
              })
              .eq("id", duplicateMatch.item.id);

            await adminSupabase
              .from("incident_candidates")
              .update({
                status: "duplicate",
                notes: `Merged as an additional source into incident "${duplicateMatch.item.title}" (${duplicateMatch.item.id}), similarity ${duplicateMatch.score.toFixed(2)}.`,
                updated_at: new Date().toISOString(),
              })
              .eq("id", next.id);

            duplicatesMerged++;
          } else {
            const { error: publishError } =
              await adminSupabase.rpc(
                "publish_incident_candidate",
                {
                  p_candidate_id: next.id,
                  p_title: next.title,
                  p_company: result.company as string,
                  p_model: result.model,
                  p_severity: result.severity as string,
                  p_category: result.category,
                  p_occurred_at: next.published_at,
                  p_summary: result.incident_summary as string,
                  p_description:
                    result.incident_description as string,
                }
              );

            if (publishError) {
              console.error(
                "Auto-publish failed, leaving for human review:",
                publishError
              );

              await adminSupabase
                .from("incident_candidates")
                .update({
                  status: "reviewing",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", next.id);

              leftForHuman++;
            } else {
              await adminSupabase
                .from("incident_candidates")
                .update({
                  status: "accepted",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", next.id);

              autoPublished++;
            }
          }
        } else {
          // "review" recommendation, low confidence, or missing
          // fields required to publish — a human decides this one.
          await adminSupabase
            .from("incident_candidates")
            .update({
              status: "reviewing",
              updated_at: new Date().toISOString(),
            })
            .eq("id", next.id);

          leftForHuman++;
        }
      } catch (reviewError) {
        console.error(
          `Review failed for ${next.article_url}:`,
          reviewError
        );

        reviewFailed++;

        await adminSupabase
          .from("incident_candidates")
          .update({
            status: "pending",
            ai_review_status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", next.id);
      }
    }

    console.log(
      [
        "Batch review complete.",
        `Reviewed ${reviewed}.`,
        `Auto-published ${autoPublished}.`,
        `Merged as duplicates ${duplicatesMerged}.`,
        `Auto-rejected ${autoRejected}.`,
        `Left for human ${leftForHuman}.`,
        `Failed ${reviewFailed}.`,
      ].join(" ")
    );

    /*
     * ----------------------------------------------------------
     * 6. Mark discovery successful
     * ----------------------------------------------------------
     */

    if (discoveryRunId) {
      const {
        error,
      } =
        await adminSupabase
          .from("discovery_runs")
          .update({
            completed_at:
              new Date().toISOString(),

            status:
              "success",

            discovered:
              candidates.length,

            inserted,
          })
          .eq(
            "id",
            discoveryRunId
          );

      if (error) {
        console.error(
          "Failed to update discovery run:",
          error
        );
      }
    }

    /*
     * ----------------------------------------------------------
     * 7. Logging
     * ----------------------------------------------------------
     */

    console.log(
      [
        "Frontier discovery complete.",
        `Found ${candidates.length}.`,
        `Inserted ${inserted}.`,
        `Duplicates ${duplicates}.`,
      ].join(" ")
    );

    /*
     * ----------------------------------------------------------
     * 8. Return results
     * ----------------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      discovered:
        candidates.length,

      inserted,

      duplicates,

      review: {
        reviewed,
        auto_published: autoPublished,
        merged_as_duplicates: duplicatesMerged,
        auto_rejected: autoRejected,
        left_for_human: leftForHuman,
        failed: reviewFailed,
      },
    });
  } catch (error) {
    console.error(
      "Discovery failed:",
      error
    );

    /*
     * ----------------------------------------------------------
     * 9. Record discovery failure
     * ----------------------------------------------------------
     */

    if (discoveryRunId) {
      await adminSupabase
        .from("discovery_runs")
        .update({
          completed_at:
            new Date().toISOString(),

          status:
            "failed",

          error_message:
            error instanceof Error
              ? error.message
              : "Unknown discovery error",
        })
        .eq(
          "id",
          discoveryRunId
        );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Discovery process failed.",
      },
      {
        status: 500,
      }
    );
  }
}