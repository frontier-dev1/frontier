import { NextResponse } from "next/server";

import {
  discoverNews,
} from "@/lib/news/scraper";

import {
  reviewNewsArticle,
} from "@/lib/ai/news-reviewer";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/*
 * Maximum number of newly discovered articles
 * that Gemini will review during one execution.
 */
const MAX_AI_REVIEWS = 20;

/*
 * Minimum relevance score required for
 * automatic publication.
 */
const MIN_RELEVANCE_SCORE = 60;

export async function POST(
  request: Request
) {
  try {
    /*
     * ---------------------------------------------------------
     * 1. Authentication
     * ---------------------------------------------------------
     *
     * Automated GitHub Actions requests use the cron secret.
     *
     * Manual requests can be made by authenticated admins.
     * ---------------------------------------------------------
     */

    const cronSecret =
      process.env.FRONTIER_CRON_SECRET;

    const authorization =
      request.headers.get(
        "authorization"
      );

    const providedSecret =
      authorization?.startsWith(
        "Bearer "
      )
        ? authorization.slice(7)
        : null;

    const isAutomatedRequest =
      Boolean(
        cronSecret &&
          providedSecret &&
          providedSecret ===
            cronSecret
      );

    if (!isAutomatedRequest) {
      return NextResponse.json(
        {
          error:
            "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * Create service-role Supabase client
     * ---------------------------------------------------------
     */

    const supabase =
      createAdminClient();

    /*
     * ---------------------------------------------------------
     * 1. Discover new articles
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
     * 2. Process discovered articles
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
         *
         * We check both article_url and source_url because
         * source_url has a UNIQUE constraint in ai_news.
         */

        const {
          data: existingByArticle,
          error: articleCheckError,
        } = await supabase
          .from("ai_news")
          .select("id")
          .eq(
            "article_url",
            article.article_url
          )
          .maybeSingle();

        if (articleCheckError) {
          console.error(
            "Article duplicate check failed:",
            articleCheckError
          );

          failed++;
          continue;
        }

        if (existingByArticle) {
          duplicates++;
          continue;
        }

        /*
         * Check source_url as well.
         */

        const {
          data: existingBySource,
          error: sourceCheckError,
        } = await supabase
          .from("ai_news")
          .select("id")
          .eq(
            "source_url",
            article.source_url
          )
          .maybeSingle();

        if (sourceCheckError) {
          console.error(
            "Source URL duplicate check failed:",
            sourceCheckError
          );

          failed++;
          continue;
        }

        if (existingBySource) {
          duplicates++;
          continue;
        }

        /*
         * -----------------------------------------------------
         * AI editorial review
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
         * Determine whether to publish
         * -----------------------------------------------------
         *
         * The reviewer returns:
         *
         *   is_relevant
         *   relevance_score
         *
         * There is no "recommendation" field in the
         * current reviewer.
         */

        if (
          !review.is_relevant ||
          review.relevance_score <
            MIN_RELEVANCE_SCORE
        ) {
          console.log(
            `Rejected news article: ${article.title} ` +
              `(score: ${review.relevance_score})`
          );

          rejected++;
          continue;
        }

        /*
         * -----------------------------------------------------
         * Insert approved article
         * -----------------------------------------------------
         */

        const now =
          new Date().toISOString();

        const {
          error: insertError,
        } = await supabase
          .from("ai_news")
          .insert({
            /*
             * Public-facing article information
             */

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

            /*
             * Article content
             */

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

            /*
             * AI editorial information
             */

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

            /*
             * Timestamps
             */

            created_at:
              now,

            updated_at:
              now,
          });

        if (insertError) {
          console.error(
            "News insert failed:",
            insertError
          );

          failed++;
          continue;
        }

        console.log(
          `Published AI news article: ${review.title}`
        );

        published++;
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

      minimum_relevance_score:
        MIN_RELEVANCE_SCORE,

      maximum_ai_reviews:
        MAX_AI_REVIEWS,
    });
  } catch (error) {
    console.error(
      "News discovery failed:",
      error
    );

    return NextResponse.json(
      {
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