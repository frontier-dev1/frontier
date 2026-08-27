import Link from "next/link";
import { createClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

type NewsArticle = {
  id: string;
  title: string;
  source_name: string;
  source_url: string;
  summary: string | null;
  category: string | null;
  published_at: string | null;
  discovered_at: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  article_url: string | null;
  article_text: string | null;
  article_text_source: string | null;
  article_text_fetched_at: string | null;
  article_text_length: number;
  article_fetch_status: string;
  ai_relevance_score: number | null;
  ai_summary: string | null;
  ai_category: string | null;
  ai_company: string | null;
  ai_model: string | null;
  ai_importance: string | null;
  ai_reasoning: string | null;
  ai_reviewed_at: string | null;
};

function formatDate(date: string | null) {
  if (!date) {
    return null;
  }

  return new Date(date).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

function importanceStyles(
  importance: string | null
) {
  switch (
    importance?.toLowerCase()
  ) {
    case "high":
      return "border-red-400/20 bg-red-400/10 text-red-300";

    case "medium":
    case "moderate":
      return "border-yellow-400/20 bg-yellow-400/10 text-yellow-300";

    case "low":
      return "border-slate-400/20 bg-slate-400/10 text-slate-300";

    default:
      return "border-blue-400/20 bg-blue-400/10 text-blue-300";
  }
}

export default async function AINewsPage() {
  const supabase =
    await createClient();

  const {
    data: articles,
    error,
  } =
    await supabase
      .from("ai_news")
      .select(
        `
          id,
          title,
          source_name,
          source_url,
          summary,
          category,
          published_at,
          discovered_at,
          image_url,
          created_at,
          updated_at,
          article_url,
          article_text,
          article_text_source,
          article_text_fetched_at,
          article_text_length,
          article_fetch_status,
          ai_relevance_score,
          ai_summary,
          ai_category,
          ai_company,
          ai_model,
          ai_importance,
          ai_reasoning,
          ai_reviewed_at
        `
      )
      .order(
        "published_at",
        {
          ascending: false,
          nullsFirst: false,
        }
      )
      .limit(50);

  if (error) {
    console.error(
      "Unable to load AI news:",
      error
    );
  }

  const news =
    (articles ??
      []) as NewsArticle[];

  return (
    <main className="min-h-screen bg-slate-950 text-white">

      {/* Background gradient */}

      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">

        <div className="absolute left-1/2 top-[-300px] h-[650px] w-[900px] -translate-x-1/2 rounded-full bg-blue-600/20 blur-[140px]" />

        <div className="absolute right-[-200px] top-[500px] h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[130px]" />

        <div className="absolute bottom-[-250px] left-[-200px] h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[130px]" />

      </div>

      {/* Header */}

      <header className="relative z-10 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <Link
            href="/"
            className="group"
          >
            <div className="text-xs font-bold tracking-[0.3em] text-blue-400">
              FRONTIER
            </div>

            <div className="text-xs text-slate-500 transition group-hover:text-slate-400">
              AI Intelligence
            </div>
          </Link>

          <nav className="flex items-center gap-6 text-sm">

            <Link
              href="/"
              className="text-slate-400 transition hover:text-white"
            >
              Home
            </Link>

            <Link
              href="/incidents"
              className="text-slate-400 transition hover:text-white"
            >
              Incidents
            </Link>

            <Link
              href="/ai-news"
              className="font-semibold text-white"
            >
              AI News
            </Link>

            <Link
              href="/about"
              className="text-slate-400 transition hover:text-white"
            >
              About
            </Link>

          </nav>

        </div>

      </header>

      {/* Hero */}

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-14 pt-20">

        <div className="max-w-3xl">

          <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">

            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />

            AI News

          </div>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            What&apos;s happening in AI.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
            Relevant developments, research,
            product launches, security events,
            and other important stories shaping
            the artificial intelligence landscape.
          </p>

        </div>

      </section>

      {/* News */}

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-24">

        {news.length === 0 ? (

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-12 text-center">

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-blue-400/20 bg-blue-400/10 text-blue-300">
              +
            </div>

            <h2 className="mt-5 text-xl font-semibold">
              AI news is coming soon
            </h2>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Frontier is currently collecting
              and reviewing relevant developments
              across the AI ecosystem.
            </p>

          </div>

        ) : (

          <div className="grid gap-5 lg:grid-cols-2">

            {news.map(
              (article) => {

                const date =
                  article.published_at ||
                  article.discovered_at;

                const formattedDate =
                  formatDate(date);

                const articleLink =
                  article.article_url ||
                  article.source_url;

                const displayCategory =
                  article.ai_category ||
                  article.category;

                const displaySummary =
                  article.ai_summary ||
                  article.summary;

                return (
                  <article
                    key={article.id}
                    className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] p-6 transition duration-300 hover:-translate-y-1 hover:border-blue-400/30 hover:bg-white/[0.065]"
                  >

                    {/* Accent */}

                    <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-blue-400 via-indigo-400 to-cyan-400 opacity-70" />

                    <div className="pl-2">

                      {/* Metadata */}

                      <div className="flex flex-wrap items-center gap-3 text-xs">

                        {displayCategory && (
                          <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 font-semibold text-blue-300">
                            {displayCategory}
                          </span>
                        )}

                        {article.ai_importance && (
                          <span
                            className={`rounded-full border px-2.5 py-1 font-semibold ${importanceStyles(
                              article.ai_importance
                            )}`}
                          >
                            {article.ai_importance}
                            {" "}
                            importance
                          </span>
                        )}

                        <span className="font-medium text-slate-500">
                          {article.source_name}
                        </span>

                        {formattedDate && (
                          <>
                            <span className="text-slate-700">
                              •
                            </span>

                            <span className="text-slate-500">
                              {formattedDate}
                            </span>
                          </>
                        )}

                      </div>

                      {/* Title */}

                      <h2 className="mt-5 text-xl font-bold leading-8 text-white transition group-hover:text-blue-200">
                        {article.title}
                      </h2>

                      {/* Company / model */}

                      {(article.ai_company ||
                        article.ai_model) && (
                        <div className="mt-3 flex flex-wrap gap-2">

                          {article.ai_company && (
                            <span className="rounded-md bg-white/[0.06] px-2.5 py-1 text-xs text-slate-400">
                              {article.ai_company}
                            </span>
                          )}

                          {article.ai_model && (
                            <span className="rounded-md bg-white/[0.06] px-2.5 py-1 text-xs text-slate-400">
                              {article.ai_model}
                            </span>
                          )}

                        </div>
                      )}

                      {/* Summary */}

                      {displaySummary && (
                        <p className="mt-4 line-clamp-4 text-sm leading-7 text-slate-400">
                          {displaySummary}
                        </p>
                      )}

                      {/* Footer */}

                      <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">

                        <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-600">
                          Frontier AI News
                        </span>

                        {articleLink ? (
                          <a
                            href={articleLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-blue-400 transition hover:text-blue-300"
                          >
                            Read article ↗
                          </a>
                        ) : (
                          <span className="text-xs text-slate-600">
                            Source unavailable
                          </span>
                        )}

                      </div>

                    </div>

                  </article>
                );
              }
            )}

          </div>

        )}

      </section>

      {/* Footer */}

      <footer className="relative z-10 border-t border-white/10">

        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">

          <div className="text-xs text-slate-600">
            © {new Date().getFullYear()} Frontier
          </div>

          <div className="flex gap-5 text-xs text-slate-600">

            <Link
              href="/"
              className="transition hover:text-slate-400"
            >
              Home
            </Link>

            <Link
              href="/incidents"
              className="transition hover:text-slate-400"
            >
              Incidents
            </Link>

            <Link
              href="/about"
              className="transition hover:text-slate-400"
            >
              About
            </Link>

          </div>

        </div>

      </footer>

    </main>
  );
}