import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { discoverNews } from "@/lib/news/scraper";
import { reviewNewsArticle } from "@/lib/ai/news-reviewer";

export const dynamic = "force-dynamic";

const MAX_AI_REVIEWS = 20;
const MIN_RELEVANCE_SCORE = 60;

export async function POST() {
  try {
    /*
     * ---------------------------------------------------------
     * 1. Authenticate administrator
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
        .eq(
          "user_id",
          user.id
        )
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
     * 2. Discover articles
     * ---------------------------------------------------------
     */

    console.log(
      "Starting manual AI news discovery..."
    );

    const discovered =
      await discoverNews();

    console.log(
      `News discovery found ${discovered.length} candidates.`
    );

    /*
     * ---------------------------------------------------------
     * 3. Create admin Supabase client
     * ---------------------------------------------------------
     */

    const adminSupabase =
      createAdminClient();

    let reviewed = 0;
    let published = 0;
    let rejected = 0;
    let duplicates = 0;
    let failed = 0;

    const results: Array<{
      title: string;
      status:
        | "published"
        | "rejected"
        | "duplicate"
        | "failed";
      score?: number;
      reason?: string;
    }> = [];

    /*
     * ---------------------------------------------------------
     * 4. Review discovered articles
     * ---------------------------------------------------------
     */

    for (
      const article of discovered.slice(
        0,
        MAX_AI_REVIEWS
      )
    ) {
      try {
        /*
         * -----------------------------------------------------
         * Check for existing article
         * -----------------------------------------------------
         */

        const {
          data: existing,
          error: existingError,
        } =
          await adminSupabase
            .from("ai_news")
            .select("id")
            .or(
              `article_url.eq.${article.article_url},source_url.eq.${article.source_url}`
            )
            .limit(1)
            .maybeSingle();

        if (existingError) {
          console.error(
            "Duplicate check failed:",
            existingError
          );

          failed++;

          results.push({
            title:
              article.title,
            status:
              "failed",
            reason:
              "Duplicate check failed.",
          });

          continue;
        }

        if (existing) {
          duplicates++;

          results.push({
            title:
              article.title,
            status:
              "duplicate",
          });

          continue;
        }

        /*
         * -----------------------------------------------------
         * Gemini review
         * -----------------------------------------------------
         */

        console.log(
          `Reviewing news article: ${article.title}`
        );

        const review =
          await reviewNewsArticle({
            title:
              article.title,

            sourceName:
              article.source_name,

            sourceUrl:
              article.source_url,

            articleUrl:
              article.article_url,

            summary:
              article.summary,

            articleText:
              article.article_text,
          });

        reviewed++;

        /*
         * -----------------------------------------------------
         * Relevance decision
         * -----------------------------------------------------
         */

        if (
          !review.is_relevant ||
          review.relevance_score <
            MIN_RELEVANCE_SCORE
        ) {
          rejected++;

          results.push({
            title:
              article.title,

            status:
              "rejected",

            score:
              review.relevance_score,

            reason:
              review.reasoning,
          });

          continue;
        }

        /*
         * -----------------------------------------------------
         * Insert into ai_news
         * -----------------------------------------------------
         */

        const now =
          new Date().toISOString();

        const {
          error: insertError,
        } =
          await adminSupabase
            .from("ai_news")
            .insert({
              title:
                review.title ||
                article.title,

              source_name:
                article.source_name,

              source_url:
                article.source_url,

              article_url:
                article.article_url,

              summary:
                review.summary ||
                article.summary,

              category:
                review.category,

              published_at:
                article.published_at,

              discovered_at:
                article.discovered_at,

              article_text:
                article.article_text,

              article_text_source:
                article.article_text_source,

              article_text_fetched_at:
                article.article_text_fetched_at,

              article_text_length:
                article.article_text_length,

              article_fetch_status:
                article.article_fetch_status,

              ai_relevance_score:
                review.relevance_score,

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

              ai_reviewed_at:
                now,

              created_at:
                now,

              updated_at:
                now,
            });

        if (insertError) {
          console.error(
            "Failed to insert news article:",
            insertError
          );

          failed++;

          results.push({
            title:
              article.title,

            status:
              "failed",

            reason:
              insertError.message,
          });

          continue;
        }

        published++;

        results.push({
          title:
            article.title,

          status:
            "published",

          score:
            review.relevance_score,
        });
      } catch (error) {
        console.error(
          `News article processing failed for ${article.article_url}:`,
          error
        );

        failed++;

        results.push({
          title:
            article.title,

          status:
            "failed",

          reason:
            error instanceof Error
              ? error.message
              : "Unknown error.",
        });
      }
    }

    /*
     * ---------------------------------------------------------
     * 5. Return detailed results
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      discovered:
        discovered.length,

      reviewed,

      published,

      rejected,

      duplicates,

      failed,

      results,
    });
  } catch (error) {
    console.error(
      "Manual news discovery failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "News discovery failed.",
      },
      {
        status: 500,
      }
    );
  }
}