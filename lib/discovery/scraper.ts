import Parser from "rss-parser";

type FeedItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  creator?: string;
  source?: {
    name?: string;
  };
};

export type DiscoveredCandidate = {
  title: string;
  source_url: string;
  article_url: string;
  source_name: string;
  summary: string | null;
  published_at: string | null;
  relevance_score: number;
  matched_keywords: string[];

  article_text: string | null;
  article_text_source: string | null;
  article_text_fetched_at: string | null;
  article_text_length: number;
  article_fetch_status: string;
};

const parser = new Parser();

const RSS_FEEDS = [
  "https://news.google.com/rss/search?q=%22rogue+AI%22&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=%22AI+agent%22+hack&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=%22AI+agent%22+%22unauthorized%22&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=%22AI+agent%22+%22unexpected+behavior%22&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=%22AI+model%22+%22went+rogue%22&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=%22AI+agent%22+%22safety+incident%22&hl=en-US&gl=US&ceid=US:en",
];

const KEYWORDS: Record<string, number> = {
  "rogue AI": 30,
  "went rogue": 30,
  "AI agent": 10,
  "unauthorized": 20,
  "unexpected behavior": 25,
  "unexpected action": 25,
  "escaped": 25,
  "escape": 20,
  "hacked": 25,
  "hack": 20,
  "breach": 20,
  "compromised": 20,
  "deceived": 25,
  "deception": 20,
  "misaligned": 25,
  "misalignment": 25,
  "reward hacking": 25,
  "scheming": 25,
  "self-replicated": 30,
  "exfiltrated": 30,
  "exfiltration": 25,
  "refused shutdown": 30,
  "bypassed": 20,
  "broke containment": 30,
  "escaped containment": 35,
};

const TRUSTED_SOURCES = [
  "reuters.com",
  "apnews.com",
  "wired.com",
  "technologyreview.com",
  "arstechnica.com",
  "theguardian.com",
  "nytimes.com",
  "washingtonpost.com",
  "bbc.com",
  "bbc.co.uk",
  "cnn.com",
  "axios.com",
  "openai.com",
  "anthropic.com",
  "deepmind.google",
  "metr.org",
];

function calculateRelevance(
  title: string,
  summary: string
) {
  const text =
    `${title} ${summary}`.toLowerCase();

  let score = 0;

  const matchedKeywords: string[] = [];

  for (
    const [keyword, weight]
    of Object.entries(KEYWORDS)
  ) {
    if (
      text.includes(
        keyword.toLowerCase()
      )
    ) {
      score += weight;

      matchedKeywords.push(
        keyword
      );
    }
  }

  return {
    score: Math.min(score, 100),
    matchedKeywords,
  };
}

function getDomain(
  url: string
) {
  try {
    return new URL(url)
      .hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

function isTrustedSource(
  url: string
) {
  const domain =
    getDomain(url);

  return TRUSTED_SOURCES.some(
    (trusted) =>
      domain === trusted ||
      domain.endsWith(
        `.${trusted}`
      )
  );
}

/**
 * Resolve a Google News/RSS URL to the
 * final article URL.
 *
 * GET is intentionally used instead of HEAD.
 * Some publishers and redirect services do not
 * handle HEAD requests correctly.
 */
async function resolveUrl(
  url: string
) {
  try {
    const response =
      await fetch(url, {
        method: "GET",
        redirect: "follow",

        headers: {
          "User-Agent":
            "Frontier Incident Research Bot/1.0",

          Accept:
            "text/html,application/xhtml+xml",
        },

        signal:
          AbortSignal.timeout(
            10000
          ),
      });

    return (
      response.url || url
    );
  } catch {
    return url;
  }
}

/**
 * Clean extracted text.
 */
function cleanText(
  text: string
) {
  return text
    .replace(/\r/g, "")
    .replace(
      /[ \t]+/g,
      " "
    )
    .replace(
      /\n\s*\n\s*\n+/g,
      "\n\n"
    )
    .trim();
}

/**
 * Decode common HTML entities.
 */
function decodeHtmlEntities(
  text: string
) {
  return text
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /&apos;/gi,
      "'"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    );
}

/**
 * Extract JSON-LD blocks from a page.
 *
 * Many modern publishers expose article
 * metadata through JSON-LD even when the visible
 * article HTML is difficult to parse.
 */
function extractJsonLd(
  html: string
): string[] {
  const results: string[] = [];

  const matches =
    html.matchAll(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    );

  for (
    const match of matches
  ) {
    const raw =
      match[1]?.trim();

    if (!raw) {
      continue;
    }

    try {
      const parsed =
        JSON.parse(raw);

      const objects =
        Array.isArray(
          parsed
        )
          ? parsed
          : [parsed];

      for (
        const object
        of objects
      ) {
        if (
          !object ||
          typeof object !==
            "object"
        ) {
          continue;
        }

        const articleBody =
          typeof object.articleBody ===
          "string"
            ? object.articleBody
            : null;

        const description =
          typeof object.description ===
          "string"
            ? object.description
            : null;

        const headline =
          typeof object.headline ===
          "string"
            ? object.headline
            : null;

        if (articleBody) {
          results.push(
            articleBody
          );
        }

        if (
          description &&
          description.length > 100
        ) {
          results.push(
            description
          );
        }

        if (
          headline &&
          headline.length > 20
        ) {
          results.push(
            headline
          );
        }
      }
    } catch {
      /*
       * Invalid JSON-LD is common.
       * Ignore it and continue.
       */
    }
  }

  return results;
}

/**
 * Extract OpenGraph/meta descriptions.
 */
function extractMetaContent(
  html: string
): string[] {
  const results: string[] = [];

  const patterns = [
    /<meta\b[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/gi,

    /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/gi,

    /<meta\b[^>]*name=["']twitter:description["'][^>]*content=["']([^"']+)["'][^>]*>/gi,
  ];

  for (
    const pattern
    of patterns
  ) {
    const matches =
      html.matchAll(
        pattern
      );

    for (
      const match
      of matches
    ) {
      if (
        match[1]
      ) {
        results.push(
          decodeHtmlEntities(
            match[1]
          )
        );
      }
    }
  }

  return results;
}

/**
 * Extract readable article text from normal HTML.
 */
function extractHtmlArticleText(
  html: string
): string {
  let text = html;

  /*
   * Remove elements that almost never
   * contain useful article content.
   */
  text = text.replace(
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    " "
  );

  text = text.replace(
    /<style\b[^>]*>[\s\S]*?<\/style>/gi,
    " "
  );

  text = text.replace(
    /<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,
    " "
  );

  text = text.replace(
    /<svg\b[^>]*>[\s\S]*?<\/svg>/gi,
    " "
  );

  text = text.replace(
    /<nav\b[^>]*>[\s\S]*?<\/nav>/gi,
    " "
  );

  text = text.replace(
    /<footer\b[^>]*>[\s\S]*?<\/footer>/gi,
    " "
  );

  text = text.replace(
    /<header\b[^>]*>[\s\S]*?<\/header>/gi,
    " "
  );

  text = text.replace(
    /<aside\b[^>]*>[\s\S]*?<\/aside>/gi,
    " "
  );

  /*
   * Preserve paragraph-like separation.
   */
  text = text.replace(
    /<\/(p|article|section|div|li|h1|h2|h3|h4|h5|blockquote)>/gi,
    "\n"
  );

  /*
   * Remove remaining HTML tags.
   */
  text = text.replace(
    /<[^>]+>/g,
    " "
  );

  text =
    decodeHtmlEntities(
      text
    );

  return cleanText(
    text
  );
}

/**
 * Remove obvious navigation/UI noise from
 * extracted text.
 *
 * This isn't intended to be perfect. It simply
 * prevents very short menu-like pages from being
 * treated as full articles.
 */
function scoreArticleText(
  text: string
) {
  const lower =
    text.toLowerCase();

  const usefulSignals = [
    "according to",
    "researchers",
    "research",
    "model",
    "ai",
    "artificial intelligence",
    "agent",
    "experiment",
    "study",
    "said",
    "reported",
    "system",
    "company",
    "security",
    "test",
    "testing",
  ];

  let score = 0;

  for (
    const signal
    of usefulSignals
  ) {
    if (
      lower.includes(signal)
    ) {
      score += 1;
    }
  }

  /*
   * Long text with several article-like
   * signals is much more likely to be useful.
   */
  if (
    text.length >= 1000
  ) {
    score += 3;
  }

  if (
    text.length >= 3000
  ) {
    score += 3;
  }

  return score;
}

/**
 * Fetch and extract article text.
 *
 * Extraction priority:
 *
 * 1. JSON-LD articleBody
 * 2. Normal HTML
 * 3. OpenGraph/meta description
 * 4. RSS summary
 *
 * The method returns both the text and the
 * extraction source so we can see exactly what
 * happened during discovery.
 */
async function fetchArticleContent(
  url: string,
  rssSummary: string | null
): Promise<{
  text: string | null;
  source:
    | "json_ld"
    | "html"
    | "meta"
    | "rss"
    | "failed";
  status:
    | "success"
    | "partial"
    | "failed";
}> {
  try {
    const response =
      await fetch(url, {
        method: "GET",
        redirect: "follow",

        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; Frontier Incident Research Bot/1.0; +https://frontier-eight.vercel.app)",

          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",

          "Accept-Language":
            "en-US,en;q=0.9",
        },

        signal:
          AbortSignal.timeout(
            15000
          ),
      });

    if (!response.ok) {
      console.warn(
        `Article fetch returned ${response.status}: ${url}`
      );
    } else {
      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      if (
        contentType.includes(
          "text/html"
        ) ||
        contentType.includes(
          "application/xhtml+xml"
        )
      ) {
        const html =
          await response.text();

        /*
         * FIRST: JSON-LD.
         */
        const jsonLd =
          extractJsonLd(
            html
          );

        const jsonLdText =
          cleanText(
            jsonLd.join(
              "\n\n"
            )
          );

        if (
          jsonLdText.length >=
            500 &&
          scoreArticleText(
            jsonLdText
          ) >= 3
        ) {
          return {
            text:
              jsonLdText.slice(
                0,
                50000
              ),

            source:
              "json_ld",

            status:
              "success",
          };
        }

        /*
         * SECOND: normal HTML.
         */
        const htmlText =
          extractHtmlArticleText(
            html
          );

        if (
          htmlText.length >=
            500 &&
          scoreArticleText(
            htmlText
          ) >= 3
        ) {
          return {
            text:
              htmlText.slice(
                0,
                50000
              ),

            source:
              "html",

            status:
              "success",
          };
        }

        /*
         * THIRD: metadata.
         */
        const metaText =
          cleanText(
            extractMetaContent(
              html
            ).join(
              "\n\n"
            )
          );

        if (
          metaText.length >=
          100
        ) {
          return {
            text:
              metaText.slice(
                0,
                10000
              ),

            source:
              "meta",

            status:
              "partial",
          };
        }
      }
    }
  } catch (error) {
    console.warn(
      `Unable to fetch article ${url}:`,
      error
    );
  }

  /*
   * FOURTH: fall back to RSS content.
   *
   * This isn't as strong as the full article,
   * but it is better than sending Gemini nothing.
   */
  if (
    rssSummary &&
    rssSummary.trim().length >= 100
  ) {
    return {
      text:
        rssSummary
          .trim()
          .slice(
            0,
            10000
          ),

      source:
        "rss",

      status:
        "partial",
    };
  }

  return {
    text: null,
    source: "failed",
    status: "failed",
  };
}

/**
 * Discover candidates from RSS feeds.
 */
export async function discoverCandidates(): Promise<
  DiscoveredCandidate[]
> {
  const candidates: DiscoveredCandidate[] =
    [];

  for (
    const feedUrl of RSS_FEEDS
  ) {
    try {
      const feed =
        await parser.parseURL(
          feedUrl
        );

      for (
        const rawItem of feed.items as FeedItem[]
      ) {
        if (
          !rawItem.title ||
          !rawItem.link
        ) {
          continue;
        }

        const title =
          rawItem.title.trim();

        const summary =
          (
            rawItem.contentSnippet ??
            rawItem.content ??
            ""
          ).trim();

        const relevance =
          calculateRelevance(
            title,
            summary
          );

        if (
          relevance.score < 25
        ) {
          continue;
        }

        /*
         * Resolve the Google News URL
         * before fetching the actual article.
         */
        const articleUrl =
          await resolveUrl(
            rawItem.link
          );

        const trusted =
          isTrustedSource(
            articleUrl
          );

        const finalScore =
          trusted
            ? Math.min(
                relevance.score +
                  10,
                100
              )
            : relevance.score;

        /*
         * Fetch the article during discovery.
         */
        const articleContent =
          await fetchArticleContent(
            articleUrl,
            summary || null
          );

        candidates.push({
          title,

          source_url:
            articleUrl,

          article_url:
            articleUrl,

          source_name:
            getDomain(
              articleUrl
            ) || "Unknown",

          summary:
            summary || null,

          published_at:
            rawItem.pubDate
              ? new Date(
                  rawItem.pubDate
                ).toISOString()
              : null,

          relevance_score:
            finalScore,

          matched_keywords:
            relevance.matchedKeywords,

          article_text:
            articleContent.text,

          article_text_source:
            articleContent.source,

          article_text_fetched_at:
            new Date().toISOString(),

          article_text_length:
            articleContent.text
              ?.length ?? 0,

          article_fetch_status:
            articleContent.status,
        });
      }
    } catch (error) {
      console.error(
        `Failed to process feed ${feedUrl}`,
        error
      );
    }
  }

  /*
   * Remove duplicates.
   */
  const unique =
    Array.from(
      new Map(
        candidates.map(
          (candidate) => [
            candidate.article_url,
            candidate,
          ]
        )
      ).values()
    );

  /*
   * Highest relevance first.
   */
  unique.sort(
    (a, b) =>
      b.relevance_score -
      a.relevance_score
  );

  return unique;
}