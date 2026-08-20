import { NextResponse } from "next/server";

import { createClient } from "../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";

import {
  reviewCandidate,
} from "../../../../../lib/ai/reviewer";

import type { Database } from "@/database.types";

type Candidate =
  Database["public"]["Tables"]["incident_candidates"]["Row"];

export const dynamic = "force-dynamic";

type BatchRequest = {
  candidateIds?: string[];
};

type BatchResult = {
  id: string;
  status: "completed" | "failed" | "skipped";
  candidate?: unknown;
  error?: string;
};

const MAX_BATCH_SIZE = 5;

export async function POST(
  request: Request
) {
  try {
    /*
     * ----------------------------------------------------------
     * 1. Authenticate admin
     * ----------------------------------------------------------
     */

    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
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
          error:
            "Administrator access required.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * ----------------------------------------------------------
     * 2. Validate request
     * ----------------------------------------------------------
     */

    let body: BatchRequest;

    try {
      body =
        (await request.json()) as BatchRequest;
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid JSON request.",
        },
        {
          status: 400,
        }
      );
    }

    const candidateIds =
      Array.isArray(
        body.candidateIds
      )
        ? Array.from(
            new Set(
              body.candidateIds.filter(
                (id): id is string =>
                  typeof id ===
                    "string" &&
                  id.length > 0
              )
            )
          )
        : [];

    if (
      candidateIds.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No candidate IDs were provided.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Keep each HTTP request deliberately small.
     *
     * The frontend will automatically split a large
     * selection into multiple batches.
     */
    if (
      candidateIds.length >
      MAX_BATCH_SIZE
    ) {
      return NextResponse.json(
        {
          error:
            `A maximum of ${MAX_BATCH_SIZE} candidates can be processed per batch.`,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ----------------------------------------------------------
     * 3. Load candidates
     * ----------------------------------------------------------
     */

    const adminSupabase =
      createAdminClient();

    const {
      data: candidates,
      error: candidateError,
    } =
      await adminSupabase
        .from("incident_candidates")
        .select("*")
        .in("id", candidateIds);

    if (candidateError) {
      console.error(
        "Batch candidate lookup failed:",
        candidateError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load candidates.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      !candidates ||
      candidates.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No matching candidates were found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * ----------------------------------------------------------
     * 4. Review candidates
     * ----------------------------------------------------------
     *
     * We process a maximum of two AI calls at once.
     * This reduces the chance of hitting Gemini rate limits.
     */

    const results: BatchResult[] = [];

    const concurrency = 2;

    async function processCandidate(
        candidate: Candidate
    ): Promise<BatchResult> {
      /*
       * Don't start another review if one is
       * already running.
       */
      if (
        candidate.ai_review_status ===
        "reviewing"
      ) {
        return {
          id: candidate.id,
          status: "skipped",
          error:
            "Candidate is already being reviewed.",
        };
      }

      /*
       * --------------------------------------------------------
       * Mark reviewing
       * --------------------------------------------------------
       */

      const {
        error: markReviewingError,
      } =
        await adminSupabase
          .from("incident_candidates")
          .update({
            ai_review_status:
              "reviewing",

            updated_at:
              new Date().toISOString(),
          })
          .eq("id", candidate.id);

      if (markReviewingError) {
        console.error(
          `Unable to mark candidate ${candidate.id} as reviewing:`,
          markReviewingError
        );

        return {
          id: candidate.id,
          status: "failed",
          error:
            "Unable to start AI review.",
        };
      }

      try {
        /*
         * ------------------------------------------------------
         * Ask Gemini to review the candidate
         * ------------------------------------------------------
         */

        const result =
          await reviewCandidate({
            title:
              candidate.title,

            sourceName:
              candidate.source_name,

            sourceUrl:
              candidate.source_url,

            articleUrl:
              candidate.article_url,

            summary:
              candidate.summary,

            publishedAt:
              candidate.published_at,

            articleText:
              candidate.article_text ??
              null,
          });

        /*
         * ------------------------------------------------------
         * Save structured AI assessment
         * ------------------------------------------------------
         */

        const {
          data: updatedCandidate,
          error: updateError,
        } =
          await adminSupabase
            .from(
              "incident_candidates"
            )
            .update({
              ai_review_status:
                "completed",

              ai_reviewed_at:
                new Date().toISOString(),

              ai_is_incident:
                result.is_incident,

              ai_confidence:
                result.confidence,

              ai_recommendation:
                result.recommendation,

              ai_company:
                result.company,

              ai_model:
                result.model,

              ai_category:
                result.category,

              ai_severity:
                result.severity,

              ai_incident_summary:
                result.incident_summary,

              ai_incident_description:
                result.incident_description,

              ai_intended_behavior:
                result.intended_behavior,

              ai_observed_behavior:
                result.observed_behavior,

              ai_scope_violation:
                result.scope_violation,

              ai_evidence_summary:
                result.evidence_summary,

              ai_evidence_quality:
                result.evidence_quality,

              ai_reasoning:
                result.reasoning,

              ai_additional_sources:
                result.additional_sources,

              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              candidate.id
            )
            .select()
            .single();

        if (updateError) {
          console.error(
            `Failed to save AI review for ${candidate.id}:`,
            updateError
          );

          await adminSupabase
            .from(
              "incident_candidates"
            )
            .update({
              ai_review_status:
                "failed",

              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              candidate.id
            );

          return {
            id: candidate.id,
            status: "failed",
            error:
              "AI review completed but the result could not be saved.",
          };
        }

        return {
          id: candidate.id,
          status: "completed",
          candidate:
            updatedCandidate,
        };
      } catch (error) {
        console.error(
          `AI review failed for ${candidate.id}:`,
          error
        );

        /*
         * Make sure failed reviews don't remain
         * permanently stuck in "reviewing".
         */
        await adminSupabase
          .from(
            "incident_candidates"
          )
          .update({
            ai_review_status:
              "failed",

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            candidate.id
          );

        return {
          id: candidate.id,
          status: "failed",
          error:
            error instanceof Error
              ? error.message
              : "AI review failed.",
        };
      }
    }

    /*
     * Process candidates in small concurrent groups.
     */
    for (
      let i = 0;
      i < candidates.length;
      i += concurrency
    ) {
      const group =
        candidates.slice(
          i,
          i + concurrency
        );

      const groupResults =
        await Promise.all(
          group.map(
            processCandidate
          )
        );

      results.push(
        ...groupResults
      );
    }

    /*
     * ----------------------------------------------------------
     * 5. Return results
     * ----------------------------------------------------------
     */

    const completed =
      results.filter(
        (result) =>
          result.status ===
          "completed"
      ).length;

    const failed =
      results.filter(
        (result) =>
          result.status ===
          "failed"
      ).length;

    const skipped =
      results.filter(
        (result) =>
          result.status ===
          "skipped"
      ).length;

    return NextResponse.json({
      success: true,

      processed:
        results.length,

      completed,

      failed,

      skipped,

      results,
    });
  } catch (error) {
    console.error(
      "Batch AI review failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Batch AI review failed.",
      },
      {
        status: 500,
      }
    );
  }
}