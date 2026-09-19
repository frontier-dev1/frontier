import { NextResponse } from "next/server";

import {
  discoverNews,
  fetchArticle,
} from "@/lib/news/scraper";

import {
  reviewNewsArticle,
} from "@/lib/ai/news-reviewer";

import { findBestMatch } from "@/lib/duplicate-detection";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/*
 * Vercel Hobby caps Serverless Function duration at 60s. We stop
 * well before that so the platform never kills the request
 * mid-write and leaves a candidate in a half-updated state.
 */
export const maxDuration = 60;

const TIME_BUDGET_MS = 45_000;
const MIN_RELEVANCE_SCORE = 60;

/*
 * The AI industry moves fast enough that news from before this
 * date is judged not worth surfacing as "current" anymore, even
 * if it's otherwise relevant and well-written. Articles with no
 * known published_at are allowed through — we simply don't know
 * their age, so it would be wrong to penalize them for it.
 */
const MIN_PUBLISHED_DATE = new Date("2026-04-01T00:00:00Z");

/*
 * How similar two articles' titles+summaries need to be (same
 * company) to treat them as coverage of the same underlying story
 * rather than two separate news items.
 */
const DUPLICATE_SIMILARITY_THRESHOLD = 0.35;

export async function POST(
  request: Request
) {
  return runNewsDiscovery(request);
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
  return runNewsDiscovery(request);
}

async function runNewsDiscovery(
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

    const vercelCronSecret =
      process.env.CRON_SECRET;

    const isCronRequest =
      Boolean(
        providedSecret &&
          ((cronSecret &&
            providedSecret === cronSecret) ||
            (vercelCronSecret &&
              providedSecret === vercelCronSecret))
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
    let duplicateArticles = 0;
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
     * 4. Review pending candidates until we run out, or run
     *    out of safe time within this function invocation.
     * ---------------------------------------------------------
     */

    const reviewStartedAt = Date.now();

    /*
     * Groq's free tier allows 30 requests/minute. Reviewing
     * candidates back-to-back with no pacing can burst past that
     * within seconds. Spacing calls out keeps this run smooth
     * instead of hitting 429s partway through.
     */
    const MIN_MS_BETWEEN_REVIEWS = 2_100;
    let lastReviewCallAt = 0;

    while (
      Date.now() - reviewStartedAt <
      TIME_BUDGET_MS
    ) {
      const {
        data: pending,
        error: pendingError,
      } =
        await supabase
          .from("ai_news_candidates")
          .select("*")
          .eq("status", "pending")
          .order("relevance_score", {
            ascending: false,
            nullsFirst: false,
          })
          .limit(1);

      if (pendingError) {
        console.error(
          "Unable to load news candidates:",
          pendingError
        );
        break;
      }

      const candidate = pending?.[0];

      if (!candidate) {
        break;
      }

      try {
        /*
         * Mark reviewing.
         */

        await supabase
          .from("ai_news_candidates")
          .update({
            status: "reviewing",
            updated_at: new Date().toISOString(),
          })
          .eq("id", candidate.id);

        /*
         * Discovery only stores RSS metadata — fetch the full
         * article body now, right before reviewing it.
         */

        const articleContent =
          await fetchArticle(
            candidate.article_url,
            candidate.summary
          );

        await supabase
          .from("ai_news_candidates")
          .update({
            article_text: articleContent.text,
            article_text_source: articleContent.source,
            article_text_fetched_at: new Date().toISOString(),
            article_text_length:
              articleContent.text?.length ?? 0,
            article_fetch_status: articleContent.status,
          })
          .eq("id", candidate.id);

        /*
         * Ask the AI reviewer, paced to stay under the free
         * tier's requests-per-minute limit.
         */

        const msSinceLastCall =
          Date.now() - lastReviewCallAt;

        if (msSinceLastCall < MIN_MS_BETWEEN_REVIEWS) {
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              MIN_MS_BETWEEN_REVIEWS - msSinceLastCall
            )
          );
        }

        lastReviewCallAt = Date.now();

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
              articleContent.text,
          });

        reviewed++;

        const now =
          new Date().toISOString();

        /*
         * Save the AI assessment.
         */

        const isTooOld = Boolean(
          candidate.published_at &&
            new Date(candidate.published_at) < MIN_PUBLISHED_DATE
        );

        const shouldPublish =
          !isTooOld &&
          review.is_relevant &&
          review.relevance_score >=
            MIN_RELEVANCE_SCORE;

        /*
         * -----------------------------------------------------
         * Duplicate check
         * -----------------------------------------------------
         *
         * Multiple outlets often cover the same underlying
         * story. ai_news has no field to merge sources into
         * (unlike incidents), so a duplicate here is suppressed
         * rather than published a second time.
         */

        let isDuplicate = false;
        let duplicateOfTitle: string | null = null;

        if (shouldPublish && review.company) {
          const { data: sameCompanyArticles } =
            await supabase
              .from("ai_news")
              .select("title, summary")
              .ilike("ai_company", review.company)
              .order("created_at", { ascending: false })
              .limit(15);

          const duplicateMatch = findBestMatch(
            `${review.title || candidate.title} ${review.summary || ""}`,
            sameCompanyArticles ?? [],
            (article) =>
              `${article.title} ${article.summary ?? ""}`,
            DUPLICATE_SIMILARITY_THRESHOLD
          );

          if (duplicateMatch) {
            isDuplicate = true;
            duplicateOfTitle = duplicateMatch.item.title;
          }
        }

        const candidateStatus =
          isDuplicate
            ? "rejected"
            : shouldPublish
            ? "accepted"
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
                isDuplicate
                  ? `Duplicate coverage of "${duplicateOfTitle}" — not published separately.`
                  : isTooOld
                  ? `Published before the ${MIN_PUBLISHED_DATE.toISOString().slice(0, 10)} cutoff — not published as current news.`
                  : review.reasoning,

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
         * Publish automatically when approved and not a
         * duplicate of something already published.
         * -----------------------------------------------------
         */

        if (isDuplicate) {
          duplicateArticles++;
        } else if (shouldPublish) {
          const { data: existingArticle } =
            await supabase
              .from("ai_news")
              .select("id")
              .eq("source_url", candidate.source_url)
              .maybeSingle();

          if (existingArticle) {
            duplicateArticles++;
            continue;
          }

          const {
            error:
              publishError,
          } =
            await supabase
              .from("ai_news")
              .insert(
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
        const errorMessage =
          error instanceof Error
            ? error.message
            : "News review failed.";

        const isRateLimit =
          errorMessage.includes("429") ||
          errorMessage
            .toLowerCase()
            .includes("rate limit") ||
          errorMessage
            .toLowerCase()
            .includes("quota");

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
            // "failed" isn't an allowed status value in this
            // table — put it back to pending so it's retried
            // on a future run rather than getting stuck.
            status:
              "pending",

            ai_reasoning:
              errorMessage,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            candidate.id
          );

        if (isRateLimit) {
          console.log(
            "Rate limited — stopping this run early instead of retrying into the same wall."
          );
          break;
        }
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

      duplicate_articles:
        duplicateArticles,

      failed,

      time_budget_ms:
        TIME_BUDGET_MS,

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