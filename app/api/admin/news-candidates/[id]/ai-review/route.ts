import { NextResponse } from "next/server";

import { createClient } from "../../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../../lib/supabase/admin";

import {
  reviewNewsArticle,
} from "../../../../../../lib/ai/news-reviewer";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    /*
     * ---------------------------------------------------------
     * 1. Authenticate admin
     * ---------------------------------------------------------
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
     * ---------------------------------------------------------
     * 2. Get candidate ID
     * ---------------------------------------------------------
     */

    const {
      id,
    } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Candidate ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * 3. Load candidate
     * ---------------------------------------------------------
     */

    const adminSupabase =
      createAdminClient();

    const {
      data: candidate,
      error: candidateError,
    } =
      await adminSupabase
        .from("ai_news_candidates")
        .select("*")
        .eq("id", id)
        .single();

    if (candidateError) {
      console.error(
        "News candidate lookup failed:",
        candidateError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load news candidate.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * 4. Prevent duplicate concurrent reviews
     * ---------------------------------------------------------
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
     * ---------------------------------------------------------
     * 5. Mark reviewing
     * ---------------------------------------------------------
     */

    const {
      error: markReviewingError,
    } =
      await adminSupabase
        .from("ai_news_candidates")
        .update({
          ai_review_status:
            "reviewing",

          status:
            "reviewing",

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", id);

    if (markReviewingError) {
      console.error(
        "Unable to mark news candidate as reviewing:",
        markReviewingError
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

    try {
      /*
       * -------------------------------------------------------
       * 6. Ask Gemini to review article
       * -------------------------------------------------------
       */

      const review =
        await reviewNewsArticle({
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

          articleText:
            candidate.article_text,
        });

      /*
       * -------------------------------------------------------
       * 7. Save AI review
       * -------------------------------------------------------
       */

      const now =
        new Date().toISOString();

      const {
        data: updatedCandidate,
        error: updateError,
      } =
        await adminSupabase
          .from("ai_news_candidates")
          .update({
            ai_review_status:
              "completed",

            ai_reviewed_at:
              now,

            ai_is_relevant:
              review.is_relevant,

            ai_relevance_score:
              review.relevance_score,

            ai_title:
              review.title,

            ai_summary:
              review.summary,

            ai_category:
              review.category,

            ai_company:
              review.company,

            ai_model:
              review.model,

            ai_importance:
              review.importance,

            ai_reasoning:
              review.reasoning,

            updated_at:
              now,
          })
          .eq("id", id)
          .select()
          .single();

      if (updateError) {
        console.error(
          "Unable to save news AI review:",
          updateError
        );

        await adminSupabase
          .from("ai_news_candidates")
          .update({
            ai_review_status:
              "failed",

            status:
              "pending",

            updated_at:
              new Date().toISOString(),
          })
          .eq("id", id);

        return NextResponse.json(
          {
            error:
              "AI review completed but could not be saved.",
          },
          {
            status: 500,
          }
        );
      }

      /*
       * -------------------------------------------------------
       * 8. Return result
       * -------------------------------------------------------
       */

      return NextResponse.json({
        success: true,

        candidate:
          updatedCandidate,

        review,
      });
    } catch (error) {
      console.error(
        `News AI review failed for ${id}:`,
        error
      );

      await adminSupabase
        .from("ai_news_candidates")
        .update({
          ai_review_status:
            "failed",

          status:
            "pending",

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", id);

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
  } catch (error) {
    console.error(
      "News candidate AI review endpoint failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "News candidate review failed.",
      },
      {
        status: 500,
      }
    );
  }
}