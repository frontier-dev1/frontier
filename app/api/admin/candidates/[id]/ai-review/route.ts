import { NextResponse } from "next/server";

import { createClient } from "../../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../../lib/supabase/admin";

import {
  reviewCandidate,
} from "../../../../../../lib/ai/reviewer";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic =
  "force-dynamic";

export async function POST(
  _request: Request,
  context: RouteContext
) {
  const candidateId =
    (await context.params).id;

  try {
    /*
     * ----------------------------------------------------------
     * 1. Authenticate the admin
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
     * 2. Load candidate using the service-role client
     * ----------------------------------------------------------
     */

    const adminSupabase =
      createAdminClient();

    const {
      data: candidate,
      error: candidateError,
    } =
      await adminSupabase
        .from("incident_candidates")
        .select("*")
        .eq("id", candidateId)
        .maybeSingle();

    if (candidateError) {
      console.error(
        "Candidate lookup failed:",
        candidateError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load candidate.",
        },
        {
          status: 500,
        }
      );
    }

    if (!candidate) {
      return NextResponse.json(
        {
          error:
            "Candidate not found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * ----------------------------------------------------------
     * 3. Do not allow simultaneous AI reviews
     * ----------------------------------------------------------
     */

    if (
      candidate.ai_review_status ===
      "reviewing"
    ) {
      return NextResponse.json(
        {
          error:
            "This candidate is already being reviewed.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * ----------------------------------------------------------
     * 4. Mark the candidate as under review
     * ----------------------------------------------------------
     *
     * This endpoint can now safely be called by:
     *
     * - individual AI review
     * - batch AI review
     *
     * Pending candidates also move into the normal
     * editorial "reviewing" state.
     */

    const now =
      new Date().toISOString();

    const startUpdate: {
      ai_review_status: string;
      updated_at: string;
      status?: string;
    } = {
      ai_review_status:
        "reviewing",

      updated_at: now,
    };

    if (
      candidate.status ===
      "pending"
    ) {
      startUpdate.status =
        "reviewing";
    }

    const {
      error: startError,
    } =
      await adminSupabase
        .from("incident_candidates")
        .update(startUpdate)
        .eq("id", candidateId);

    if (startError) {
      console.error(
        "Failed to start AI review:",
        startError
      );

      return NextResponse.json(
        {
          error:
            "Unable to start AI review.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * ----------------------------------------------------------
     * 5. Ask Gemini to review the article
     * ----------------------------------------------------------
     *
     * The article text fetched during discovery is preferred.
     * reviewCandidate() will attempt another fetch if it is
     * unavailable.
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
     * ----------------------------------------------------------
     * 6. Save the structured AI assessment
     * ----------------------------------------------------------
     */

    const {
      data: updatedCandidate,
      error: updateError,
    } =
      await adminSupabase
        .from("incident_candidates")
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
        .eq("id", candidateId)
        .select()
        .single();

    if (updateError) {
      console.error(
        "Failed to save AI review:",
        updateError
      );

      /*
       * The Gemini call succeeded, but the
       * database write failed.
       */

      await adminSupabase
        .from("incident_candidates")
        .update({
          ai_review_status:
            "failed",

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", candidateId);

      return NextResponse.json(
        {
          error:
            "AI review completed, but Frontier could not save the result.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * ----------------------------------------------------------
     * 7. Return the updated candidate
     * ----------------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      candidate:
        updatedCandidate,

      review:
        result,
    });
  } catch (error) {
    console.error(
      "AI review failed:",
      error
    );

    /*
     * ----------------------------------------------------------
     * 8. Mark failed reviews
     * ----------------------------------------------------------
     */

    try {
      const adminSupabase =
        createAdminClient();

      await adminSupabase
        .from("incident_candidates")
        .update({
          ai_review_status:
            "failed",

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", candidateId);
    } catch (statusError) {
      console.error(
        "Unable to mark AI review as failed:",
        statusError
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI review failed.",
      },
      {
        status: 500,
      }
    );
  }
}