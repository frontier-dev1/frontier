import { NextResponse } from "next/server";

import { discoverNews } from "@/lib/news/scraper";
import { reviewNewsArticle } from "@/lib/ai/news-reviewer";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_AI_REVIEWS = 20;

export async function POST() {
  try {
    const supabase = createAdminClient();

    /*
     * ---------------------------------------------------------
     * 1. Discover articles
     * ---------------------------------------------------------
     */

    const discovered = await discoverNews();

    console.log(
      `News discovery found ${discovered.length} articles.`
    );

    let reviewed = 0;
    let published = 0;
    let rejected = 0;
    let duplicates = 0;
    let failed = 0;

    /*
     * ---------------------------------------------------------
     * 2. Review articles
     * ---------------------------------------------------------
     *
     * We deliberately limit the number of Gemini calls
     * during a manual test.
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
        } = await supabase
          .from("ai_news")
          .select("id")
          .eq(
            "source_url",
            article.source_url
          )
          .maybeSingle();

        if (existingError) {
          console.error(
            "News duplicate check failed:",
            existingError
          );

          failed++;
          continue;
        }

        if (existing) {
          duplicates++;
          continue;
        }

        /*
         * -----------------------------------------------------
         * AI review
         * -----------------------------------------------------
         */

        const review =
          await reviewNewsArticle({
            title: article.title,

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
         * Reject articles that don't meet the threshold
         * -----------------------------------------------------
         */

        if (
          !review.is_relevant ||
          review.relevance_score < 60
        ) {
          rejected++;
          continue;
        }

        /*
         * -----------------------------------------------------
         * Insert into ai_news
         * -----------------------------------------------------
         *
         * IMPORTANT:
         * These fields match the schema you provided.
         */

        const {
          error: insertError,
        } = await supabase
          .from("ai_news")
          .insert({
            title:
              review.title ||
              article.title,

            source_name:
              review.company ||
              article.source_name,

            source_url:
              article.source_url,

            summary:
              review.summary ||
              article.summary,

            category:
              review.category,

            published_at:
              article.published_at,

            image_url:
              null,

            article_url:
              article.article_url,

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
              new Date().toISOString(),

            created_at:
              new Date().toISOString(),

            updated_at:
              new Date().toISOString(),
          });

        if (insertError) {
          console.error(
            "News insert failed:",
            insertError
          );

          failed++;
          continue;
        }

        published++;

        console.log(
          `Published AI news: ${article.title}`
        );
      } catch (error) {
        console.error(
          `News processing failed for ${article.article_url}:`,
          error
        );

        failed++;
      }
    }

    /*
     * ---------------------------------------------------------
     * 3. Return results
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

      maxReviews:
        MAX_AI_REVIEWS,
    });
  } catch (error) {
    console.error(
      "News discovery failed:",
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