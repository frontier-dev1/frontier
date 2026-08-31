import { NextResponse } from "next/server";

import { createClient } from "../../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../../lib/supabase/admin";

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
     * 2. Candidate ID
     * ---------------------------------------------------------
     */

    const {
      id,
    } = await context.params;

    const adminSupabase =
      createAdminClient();

    /*
     * ---------------------------------------------------------
     * 3. Load candidate
     * ---------------------------------------------------------
     */

    const {
      data: candidate,
      error: candidateError,
    } =
      await adminSupabase
        .from("ai_news_candidates")
        .select("*")
        .eq("id", id)
        .single();

    if (
      candidateError ||
      !candidate
    ) {
      return NextResponse.json(
        {
          error:
            "News candidate not found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * 4. Require AI review
     * ---------------------------------------------------------
     */

    if (
      candidate.ai_review_status !==
      "completed"
    ) {
      return NextResponse.json(
        {
          error:
            "This article must be AI reviewed before publishing.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      candidate.ai_is_relevant !==
      true
    ) {
      return NextResponse.json(
        {
          error:
            "This article was not considered relevant by the AI reviewer.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * 5. Insert into public ai_news
     * ---------------------------------------------------------
     */

    const now =
      new Date().toISOString();

    const {
      data: publishedArticle,
      error: publishError,
    } =
      await adminSupabase
        .from("ai_news")
        .insert({
          title:
            candidate.ai_title ||
            candidate.title,

          source_name:
            candidate.source_name,

          source_url:
            candidate.source_url,

          article_url:
            candidate.article_url,

          summary:
            candidate.ai_summary ||
            candidate.summary,

          category:
            candidate.ai_category ||
            candidate.category,

          published_at:
            candidate.published_at,

          image_url:
            candidate.image_url,

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

          ai_relevance_score:
            candidate.ai_relevance_score,

          ai_summary:
            candidate.ai_summary,

          ai_category:
            candidate.ai_category,

          ai_company:
            candidate.ai_company,

          ai_model:
            candidate.ai_model,

          ai_importance:
            candidate.ai_importance,

          ai_reasoning:
            candidate.ai_reasoning,

          ai_reviewed_at:
            candidate.ai_reviewed_at,

          created_at:
            now,

          updated_at:
            now,
        })
        .select()
        .single();

    if (publishError) {
      console.error(
        "Failed to publish news candidate:",
        publishError
      );

      return NextResponse.json(
        {
          error:
            publishError.message ||
            "Unable to publish article.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * 6. Mark candidate accepted
     * ---------------------------------------------------------
     */

    const {
      error: updateError,
    } =
      await adminSupabase
        .from("ai_news_candidates")
        .update({
          status:
            "accepted",

          updated_at:
            now,
        })
        .eq("id", id);

    if (updateError) {
      console.error(
        "Published article but failed to update candidate:",
        updateError
      );

      /*
       * The article is already published, so don't
       * report the entire operation as a failure.
       */
    }

    return NextResponse.json({
      success: true,

      published:
        publishedArticle,

      candidateId:
        id,
    });
  } catch (error) {
    console.error(
      "News publish failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to publish article.",
      },
      {
        status: 500,
      }
    );
  }
}