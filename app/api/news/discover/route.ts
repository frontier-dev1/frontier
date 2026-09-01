import { NextResponse } from "next/server";

import {
  discoverNews,
  scrapeArticleContent,
} from "@/lib/news/scraper";

import {
  reviewNewsArticle,
} from "@/lib/ai/news-reviewer";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_AI_REVIEWS = 20;
const MIN_RELEVANCE_SCORE = 60;

export async function POST(
  request: Request
) {
  try {
    /*
     * ---------------------------------------------------------
     * 1. Authenticate admin
     * ---------------------------------------------------------
     */

    const supabase = createAdminClient();

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

    const cronSecret =
      process.env.FRONTIER_CRON_SECRET;

    const isCronRequest =
      Boolean(
        cronSecret &&
          providedSecret &&
          providedSecret === cronSecret
      );

    if (!isCronRequest) {
      /*
       * The service-role client above cannot authenticate
       * the browser user. Use the normal Supabase client.
       */

      const { createClient } =
        await import(
          "@/lib/supabase/server"
        );

      const userClient =
        await createClient();

      const {
        data: { user },
      } =
        await userClient.auth.getUser();

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
        await userClient
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
    }

    /*
     * ---------------------------------------------------------
     * 2. Discover articles
     * ---------------------------------------------------------
     */

    const discovered =
      await discoverNews();

    console.log(
      `News discovery found ${discovered.length} articles.`
    );

    let candidatesInserted = 0;
    let duplicates = 0;
    let reviewed = 0;
    let published = 0;
    let rejected = 0;
    let failed = 0;

    /*
     * ---------------------------------------------------------
     * 3. Save discovered articles as candidates
     * ---------------------------------------------------------
     */

    for (const article of discovered) {
      try {
        const {
          data: candidate,
          error: candidateError,
        } =
          await supabase
            .from(
              "ai_news_candidates"
            )
            .upsert(
              {
                title:
                  article.title,

                source_name:
                  article.source_name,

                source_url:
                  article.source_url,

                article_url:
                  article.article_url,

                summary:
                  article.summary,

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

                relevance_score:
                  article.relevance_score,

                matched_keywords:
                  article.matched_keywords,

                status:
                  "pending",

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
            .select("id")
            .maybeSingle();

        if (candidateError) {
          console.error(
            "News candidate insert failed:",
            candidateError
          );

          failed++;
          continue;
        }

        if (!candidate) {
          duplicates++;
          continue;
        }

        candidatesInserted++;
      } catch (error) {
        console.error(
          "News candidate processing failed:",
          error
        );

        failed++;
      }
    }

    /*
     * ---------------------------------------------------------
     * 4. Load pending candidates for AI review
     * ---------------------------------------------------------
     */

    const {
      data: pendingCandidates,
      error:
        pendingError,
    } =
      await supabase
        .from(
          "ai_news_candidates"
        )
        .select("*")
        .eq(
          "status",
          "pending"
        )
        .order(
          "relevance_score",
          {
            ascending: false,
            nullsFirst: false,
          }
        )
        .limit(
          MAX_AI_REVIEWS
        );

    if (pendingError) {
      console.error(
        "Unable to load news candidates:",
        pendingError
      );

      return NextResponse.json(
        {
          error:
            "Discovery succeeded but candidates could not be loaded.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * 5. Review candidates
     * ---------------------------------------------------------
     */

    for (
      const candidate of
        pendingCandidates ?? []
    ) {
      try {
        /*
         * Mark reviewing.
         */

        await supabase
          .from(
            "ai_news_candidates"
          )
          .update({
            status:
              "reviewing",

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            candidate.id
          );

        /*
         * Ask Gemini.
         */

        const review =
          await reviewNewsArticle({
            title:
              candidate.title,

            sourceName:
              candidate.source_name ??
              "Unknown",

            sourceUrl:
              candidate.source_url,

            articleUrl:
              candidate.article_url,

            summary:
              candidate.summary,

            articleText:
              candidate.article_text,
          });

        reviewed++;

        const now =
          new Date().toISOString();

        /*
         * Save the AI assessment.
         */

        const shouldPublish =
          review.is_relevant &&
          review.relevance_score >=
            MIN_RELEVANCE_SCORE;

        const candidateStatus =
          shouldPublish
            ? "published"
            : "rejected";

        const {
          error:
            reviewUpdateError,
        } =
          await supabase
            .from(
              "ai_news_candidates"
            )
            .update({
              status:
                candidateStatus,

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

              ai_reviewed_at:
                now,

              updated_at:
                now,
            })
            .eq(
              "id",
              candidate.id
            );

        if (reviewUpdateError) {
          throw reviewUpdateError;
        }

        /*
         * -----------------------------------------------------
         * Publish automatically when approved.
         * -----------------------------------------------------
         */

        if (shouldPublish) {
          const {
            error:
              publishError,
          } =
            await supabase
              .from("ai_news")
              .upsert(
                {
                  title:
                    review.title ||
                    candidate.title,

                  source_name:
                    candidate.source_name ||
                    "Unknown",

                  source_url:
                    candidate.source_url,

                  article_url:
                    candidate.article_url,

                  summary:
                    review.summary ||
                    candidate.summary,

                  category:
                    review.category,

                  published_at:
                    candidate.published_at,

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
                },
                {
                  onConflict:
                    "source_url",

                  ignoreDuplicates:
                    true,
                }
              );

          if (publishError) {
            console.error(
              "AI news publication failed:",
              publishError
            );

            /*
             * It was reviewed successfully but could
             * not be published.
             */

            await supabase
              .from(
                "ai_news_candidates"
              )
              .update({
                status:
                  "failed",

                updated_at:
                  new Date().toISOString(),
              })
              .eq(
                "id",
                candidate.id
              );

            failed++;
            continue;
          }

          published++;
        } else {
          rejected++;
        }
      } catch (error) {
        console.error(
          `News review failed for ${candidate.article_url}:`,
          error
        );

        failed++;

        await supabase
          .from(
            "ai_news_candidates"
          )
          .update({
            status:
              "failed",

            ai_reasoning:
              error instanceof Error
                ? error.message
                : "News review failed.",

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            candidate.id
          );
      }
    }

    /*
     * ---------------------------------------------------------
     * 6. Return discovery statistics
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      discovered:
        discovered.length,

      candidates_inserted:
        candidatesInserted,

      duplicates,

      reviewed,

      published,

      rejected,

      failed,

      max_ai_reviews:
        MAX_AI_REVIEWS,

      minimum_relevance_score:
        MIN_RELEVANCE_SCORE,
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