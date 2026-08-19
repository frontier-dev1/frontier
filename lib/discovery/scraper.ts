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
  id: string;

  title: string;

  source_url: string;

  article_url: string;

  source_name: string;

  summary: string | null;

  published_at: string | null;

  discovered_at: string;

  status: string;

  relevance_score: number;

  matched_keywords: string[];

  notes: string | null;

  article_text: string | null;

  article_text_source: string | null;

  article_text_fetched_at: string | null;

  article_text_length: number;

  article_fetch_status:
    | "success"
    | "partial"
    | "failed";
};

const parser = new Parser();

const USER_AGENT =
  "Mozilla/5.0 (compatible; Frontier Incident Research Bot/1.0; +https://frontier-eight.vercel.app/)";

const MAX_ARTICLE_LENGTH = 50000;
const MIN_ARTICLE_LENGTH = 500;

const GOOGLE_NEWS_BOILERPLATE =
  "Comprehensive up-to-date news coverage, aggregated from sources all over the world by Google News.";

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
  unauthorized: 20,
  "unexpected behavior": 25,
  "unexpected action": 25,
  escaped: 25,
  escape: 20,
  hacked: 25,
  hack: 20,
  breach: 20,
  compromised: 20,
  deceived: 25,
  deception: 20,
  misaligned: 25,
  misalignment: 25,
  "reward hacking": 25,
  scheming: 25,
  "self-replicated": 30,
  exfiltrated: 30,
  exfiltration: 25,
  "refused shutdown": 30,
  bypassed: 20,
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

function cleanText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncateText(
  text: string,
  maxCharacters: number
): string {
  if (text.length <= maxCharacters) {
    return text;
  }

  return (
    text.slice(0, maxCharacters) +
    "\n\n[ARTICLE TEXT TRUNCATED]"
  );
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function isGoogleNewsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    return (
      parsed.hostname === "news.google.com" ||
      parsed.hostname.endsWith(".news.google.com")
    );
  } catch {
    return false;
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url)
      .hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

function isTrustedSource(url: string): boolean {
  const domain = getDomain(url);

  return TRUSTED_SOURCES.some(
    (trusted) =>
      domain === trusted ||
      domain.endsWith(`.${trusted}`)
  );
}

function calculateRelevance(
  title: string,
  summary: string
) {
  const text =
    `${title} ${summary}`.toLowerCase();

  let score = 0;

  const matchedKeywords: string[] = [];

  for (const [keyword, weight] of Object.entries(
    KEYWORDS
  )) {
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

/**
 * Determines whether extracted text is actually
 * useful article content.
 */
function isUsableArticleText(
  text: string | null
): boolean {
  if (!text) {
    return false;
  }

  const cleaned =
    cleanText(text);

  if (
    cleaned.length <
    MIN_ARTICLE_LENGTH
  ) {
    return false;
  }

  /*
   * Never accept the standard Google News
   * boilerplate as article content.
   */
  if (
    cleaned
      .toLowerCase()
      .includes(
        GOOGLE_NEWS_BOILERPLATE.toLowerCase()
      )
  ) {
    return false;
  }

  /*
   * Prevent obviously empty / navigation-like
   * pages from being treated as articles.
   */
  const lower =
    cleaned.toLowerCase();

  const articleSignals = [
    "according to",
    "research",
    "researchers",
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
    "software",
  ];

  const signalCount =
    articleSignals.filter(
      (signal) =>
        lower.includes(signal)
    ).length;

  return signalCount >= 2;
}

/**
 * Fetch a URL and return HTML plus the final URL
 * after redirects.
 */
async function fetchHtml(
  url: string
): Promise<{
  html: string;
  finalUrl: string;
} | null> {
  try {
    const response =
      await fetch(url, {
        method: "GET",
        redirect: "follow",

        headers: {
          "User-Agent":
            USER_AGENT,

          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

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

      return null;
    }

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    if (
      !contentType.includes(
        "text/html"
      ) &&
      !contentType.includes(
        "application/xhtml+xml"
      )
    ) {
      return null;
    }

    const html =
      await response.text();

    return {
      html,
      finalUrl:
        response.url ||
        url,
    };
  } catch (error) {
    console.warn(
      `Unable to fetch ${url}:`,
      error
    );

    return null;
  }
}

/**
 * Convert HTML into readable text.
 */
function htmlToText(
  html: string
): string {
  let text = html;

  /*
   * Remove scripts.
   */
  text = text.replace(
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    " "
  );

  /*
   * Remove styles.
   */
  text = text.replace(
    /<style\b[^>]*>[\s\S]*?<\/style>/gi,
    " "
  );

  /*
   * Remove noscript.
   */
  text = text.replace(
    /<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,
    " "
  );

  /*
   * Remove SVG.
   */
  text = text.replace(
    /<svg\b[^>]*>[\s\S]*?<\/svg>/gi,
    " "
  );

  /*
   * Remove navigation.
   */
  text = text.replace(
    /<nav\b[^>]*>[\s\S]*?<\/nav>/gi,
    " "
  );

  /*
   * Remove footer.
   */
  text = text.replace(
    /<footer\b[^>]*>[\s\S]*?<\/footer>/gi,
    " "
  );

  /*
   * Remove header.
   */
  text = text.replace(
    /<header\b[^>]*>[\s\S]*?<\/header>/gi,
    " "
  );

  /*
   * Remove sidebars.
   */
  text = text.replace(
    /<aside\b[^>]*>[\s\S]*?<\/aside>/gi,
    " "
  );

  /*
   * Preserve paragraph boundaries.
   */
  text = text.replace(
    /<\/(p|article|section|div|li|h1|h2|h3|h4|h5|blockquote|br)>/gi,
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
    decodeHtmlEntities(text);

  return cleanText(text);
}

/**
 * Extract JSON-LD blocks.
 */
function extractJsonLd(
  html: string
): unknown[] {
  const results: unknown[] = [];

  const matches =
    html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    );

  for (const match of matches) {
    const raw =
      match[1]?.trim();

    if (!raw) {
      continue;
    }

    try {
      results.push(
        JSON.parse(raw)
      );
    } catch {
      /*
       * Invalid JSON-LD is common.
       * Ignore it.
       */
    }
  }

  return results;
}

/**
 * Recursively locate articleBody in JSON-LD.
 */
function findArticleBodyInJsonLd(
  value: unknown
): string | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result =
        findArticleBodyInJsonLd(
          item
        );

      if (
        isUsableArticleText(
          result
        )
      ) {
        return result;
      }
    }

    return null;
  }

  if (
    typeof value !== "object" ||
    value === null
  ) {
    return null;
  }

  const object =
    value as Record<
      string,
      unknown
    >;

  if (
    typeof object.articleBody ===
    "string"
  ) {
    const body =
      cleanText(
        object.articleBody
      );

    if (
      isUsableArticleText(
        body
      )
    ) {
      return body;
    }
  }

  /*
   * Some publishers put article data inside
   * @graph.
   */
  if (
    object["@graph"]
  ) {
    const result =
      findArticleBodyInJsonLd(
        object["@graph"]
      );

    if (
      isUsableArticleText(
        result
      )
    ) {
      return result;
    }
  }

  return null;
}

/**
 * Extract the <article> element.
 */
function extractArticleElement(
  html: string
): string | null {
  const match =
    html.match(
      /<article\b[^>]*>([\s\S]*?)<\/article>/i
    );

  if (!match?.[1]) {
    return null;
  }

  const text =
    htmlToText(
      match[1]
    );

  return isUsableArticleText(
    text
  )
    ? text
    : null;
}

/**
 * Extract paragraph content.
 */
function extractParagraphText(
  html: string
): string | null {
  const articleMatch =
    html.match(
      /<article\b[^>]*>([\s\S]*?)<\/article>/i
    );

  const container =
    articleMatch?.[1] ||
    html;

  const paragraphs =
    container.match(
      /<p\b[^>]*>[\s\S]*?<\/p>/gi
    ) || [];

  const text =
    paragraphs
      .map((paragraph) =>
        htmlToText(
          paragraph
        )
      )
      .filter(
        (paragraph) =>
          paragraph.length >
          40
      )
      .join("\n\n");

  return isUsableArticleText(
    text
  )
    ? text
    : null;
}

/**
 * Extract metadata descriptions.
 */
function extractMetaDescription(
  html: string
): string | null {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,

    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,

    /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i,
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      html.match(
        pattern
      );

    if (
      match?.[1]
    ) {
      const text =
        cleanText(
          decodeHtmlEntities(
            match[1]
          )
        );

      /*
       * Metadata is intentionally allowed to be
       * shorter than full article text.
       */
      if (
        text.length >= 100 &&
        !text
          .toLowerCase()
          .includes(
            GOOGLE_NEWS_BOILERPLATE.toLowerCase()
          )
      ) {
        return text;
      }
    }
  }

  return null;
}

/**
 * Extract the publisher URL from Google News HTML.
 */
function extractPublisherUrl(
  html: string
): string | null {
  const candidates: string[] =
    [];

  /*
   * Canonical URL.
   */
  const canonicalMatches =
    html.matchAll(
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/gi
    );

  for (
    const match of canonicalMatches
  ) {
    if (match[1]) {
      candidates.push(
        decodeHtmlEntities(
          match[1]
        )
      );
    }
  }

  /*
   * OpenGraph URL.
   */
  const ogMatches =
    html.matchAll(
      /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/gi
    );

  for (
    const match of ogMatches
  ) {
    if (match[1]) {
      candidates.push(
        decodeHtmlEntities(
          match[1]
        )
      );
    }
  }

  /*
   * Look for ordinary absolute URLs embedded
   * in Google News HTML.
   */
  const absoluteMatches =
    html.matchAll(
      /https?:\/\/[^"'<>\\\s]+/gi
    );

  for (
    const match of absoluteMatches
  ) {
    if (match[0]) {
      candidates.push(
        match[0]
      );
    }
  }

  for (
    const candidate of candidates
  ) {
    try {
      const url =
        new URL(
          candidate,
          "https://news.google.com"
        );

      const hostname =
        url.hostname.toLowerCase();

      if (
        hostname !==
          "news.google.com" &&
        !hostname.endsWith(
          ".news.google.com"
        )
      ) {
        return url.href;
      }
    } catch {
      /*
       * Ignore malformed URLs.
       */
    }
  }

  return null;
}

/**
 * Resolve a Google News article URL.
 *
 * We attempt:
 *
 * 1. Normal HTTP redirect
 * 2. Canonical URL
 * 3. OpenGraph URL
 * 4. Embedded publisher URL
 */
async function resolveGoogleNewsUrl(
  googleNewsUrl: string
): Promise<string | null> {
  const response =
    await fetchHtml(
      googleNewsUrl
    );

  if (!response) {
    return null;
  }

  /*
   * fetch() may have followed the redirect.
   */
  if (
    response.finalUrl &&
    !isGoogleNewsUrl(
      response.finalUrl
    )
  ) {
    return response.finalUrl;
  }

  /*
   * Otherwise inspect the HTML.
   */
  return extractPublisherUrl(
    response.html
  );
}

/**
 * Fetch article content.
 *
 * This function is intentionally separate from
 * discoverCandidates() so discovery can remain
 * responsible for candidate selection while this
 * function handles article retrieval.
 */
async function fetchArticleContent(
  url: string,
  rssSummary: string | null
): Promise<{
  text: string | null;

  source:
    | "json_ld"
    | "article"
    | "html"
    | "meta"
    | "rss"
    | "failed";

  status:
    | "success"
    | "partial"
    | "failed";

  resolvedUrl: string;
}> {
  let resolvedUrl =
    url;

  /*
   * ----------------------------------------------------------
   * 1. Resolve Google News URL
   * ----------------------------------------------------------
   */
  if (
    isGoogleNewsUrl(
      resolvedUrl
    )
  ) {
    const publisherUrl =
      await resolveGoogleNewsUrl(
        resolvedUrl
      );

    if (publisherUrl) {
      resolvedUrl =
        publisherUrl;
    }
  }

  /*
   * ----------------------------------------------------------
   * 2. Fetch publisher page
   * ----------------------------------------------------------
   */
  const response =
    await fetchHtml(
      resolvedUrl
    );

  if (!response) {
    /*
     * RSS fallback.
     */
    if (
      rssSummary &&
      rssSummary.trim()
        .length >= 100 &&
      !rssSummary
        .toLowerCase()
        .includes(
          GOOGLE_NEWS_BOILERPLATE.toLowerCase()
        )
    ) {
      return {
        text:
          truncateText(
            cleanText(
              rssSummary
            ),
            10000
          ),

        source: "rss",

        status: "partial",

        resolvedUrl,
      };
    }

    return {
      text: null,

      source: "failed",

      status: "failed",

      resolvedUrl,
    };
  }

  /*
   * Preserve final publisher URL after redirects.
   */
  if (
    response.finalUrl &&
    !isGoogleNewsUrl(
      response.finalUrl
    )
  ) {
    resolvedUrl =
      response.finalUrl;
  }

  const html =
    response.html;

  /*
   * ----------------------------------------------------------
   * 3. JSON-LD articleBody
   * ----------------------------------------------------------
   */
  const jsonLd =
    extractJsonLd(html);

  for (
    const block of jsonLd
  ) {
    const text =
      findArticleBodyInJsonLd(
        block
      );

    if (
      isUsableArticleText(
        text
      )
    ) {
      const finalText =
        truncateText(
          cleanText(text!),
          MAX_ARTICLE_LENGTH
        );

      return {
        text: finalText,

        source:
          "json_ld",

        status:
          "success",

        resolvedUrl,
      };
    }
  }

  /*
   * ----------------------------------------------------------
   * 4. <article> element
   * ----------------------------------------------------------
   */
  const articleText =
    extractArticleElement(
      html
    );

  if (
    isUsableArticleText(
      articleText
    )
  ) {
    const finalText =
      truncateText(
        cleanText(
          articleText!
        ),
        MAX_ARTICLE_LENGTH
      );

    return {
      text: finalText,

      source:
        "article",

      status:
        "success",

      resolvedUrl,
    };
  }

  /*
   * ----------------------------------------------------------
   * 5. Paragraph extraction
   * ----------------------------------------------------------
   */
  const paragraphText =
    extractParagraphText(
      html
    );

  if (
    isUsableArticleText(
      paragraphText
    )
  ) {
    const finalText =
      truncateText(
        cleanText(
          paragraphText!
        ),
        MAX_ARTICLE_LENGTH
      );

    return {
      text: finalText,

      source:
        "html",

      status:
        "success",

      resolvedUrl,
    };
  }

  /*
   * ----------------------------------------------------------
   * 6. Metadata fallback
   * ----------------------------------------------------------
   */
  const metaText =
    extractMetaDescription(
      html
    );

  if (
    metaText
  ) {
    return {
      text:
        truncateText(
          metaText,
          10000
        ),

      source:
        "meta",

      status:
        "partial",

      resolvedUrl,
    };
  }

  /*
   * ----------------------------------------------------------
   * 7. RSS fallback
   * ----------------------------------------------------------
   */
  if (
    rssSummary &&
    rssSummary.trim()
      .length >= 100 &&
    !rssSummary
      .toLowerCase()
      .includes(
        GOOGLE_NEWS_BOILERPLATE.toLowerCase()
      )
  ) {
    return {
      text:
        truncateText(
          cleanText(
            rssSummary
          ),
          10000
        ),

      source:
        "rss",

      status:
        "partial",

      resolvedUrl,
    };
  }

  return {
    text: null,

    source:
      "failed",

    status:
      "failed",

    resolvedUrl,
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
      console.log(
        `Processing discovery feed: ${feedUrl}`
      );

      const feed =
        await parser.parseURL(
          feedUrl
        );

      for (
        const rawItem of
          feed.items as FeedItem[]
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

        /*
         * Calculate relevance using the RSS
         * headline and summary.
         */
        const relevance =
          calculateRelevance(
            title,
            summary
          );

        /*
         * Ignore clearly irrelevant results.
         */
        if (
          relevance.score < 25
        ) {
          continue;
        }

        /*
         * ------------------------------------------------------
         * Resolve Google News URL to publisher URL.
         * ------------------------------------------------------
         */
        const originalUrl =
          rawItem.link;

        let articleUrl =
          originalUrl;

        if (
          isGoogleNewsUrl(
            originalUrl
          )
        ) {
          const resolved =
            await resolveGoogleNewsUrl(
              originalUrl
            );

          if (resolved) {
            articleUrl =
              resolved;
          }
        }

        /*
         * Trusted-source bonus is calculated against
         * the actual publisher URL, not news.google.com.
         */
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
         * ------------------------------------------------------
         * Fetch actual article content.
         * ------------------------------------------------------
         */
        const articleContent =
          await fetchArticleContent(
            articleUrl,
            summary || null
          );

        /*
         * If the Google News URL could not be resolved,
         * fetchArticleContent may still have useful fallback
         * data. Preserve the best URL we have.
         */
        const finalArticleUrl =
          articleContent.resolvedUrl ||
          articleUrl;

        /*
         * Use the publisher domain as source name.
         */
        const sourceName =
          getDomain(
            finalArticleUrl
          ) ||
          rawItem.source?.name ||
          "Unknown";

        candidates.push({
          id: crypto.randomUUID(),

          title,

          source_url:
            articleUrl,

          article_url:
            finalArticleUrl,

          source_name:
            sourceName,

          summary:
            summary || null,

          published_at:
            rawItem.pubDate
              ? new Date(
                  rawItem.pubDate
                ).toISOString()
              : null,

          discovered_at:
            new Date().toISOString(),

          status:
            "pending",

          relevance_score:
            finalScore,

          matched_keywords:
            relevance.matchedKeywords,

          notes:
            null,

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

        console.log(
          [
            "Candidate discovered:",
            title,
            `source=${sourceName}`,
            `text=${articleContent.text?.length ?? 0}`,
            `status=${articleContent.status}`,
            `method=${articleContent.source}`,
          ].join(" ")
        );
      }
    } catch (error) {
      console.error(
        `Failed to process feed ${feedUrl}:`,
        error
      );
    }
  }

  /*
   * ----------------------------------------------------------
   * Remove duplicates.
   * ----------------------------------------------------------
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
   * ----------------------------------------------------------
   * Highest relevance first.
   * ----------------------------------------------------------
   */
  unique.sort(
    (a, b) =>
      b.relevance_score -
      a.relevance_score
  );

  console.log(
    [
      "Discovery complete.",
      `Raw candidates: ${candidates.length}.`,
      `Unique candidates: ${unique.length}.`,
    ].join(" ")
  );

  return unique;
}