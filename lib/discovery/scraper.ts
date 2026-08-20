import Parser from "rss-parser";

type FeedItem = {
  title?: string;
  link?: string;
  guid?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  creator?: string;
  source?: {
    name?: string;
    url?: string;
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

const parser =
  new Parser<FeedItem>();

const USER_AGENT =
  "Mozilla/5.0 (compatible; Frontier Incident Research Bot/1.0; +https://frontier-eight.vercel.app/)";

const MAX_ARTICLE_LENGTH =
  50000;

const MIN_ARTICLE_LENGTH =
  500;

const GOOGLE_NEWS_BOILERPLATE =
  "Comprehensive up-to-date news coverage, aggregated from sources all over the world by Google News.";

const GOOGLE_NEWS_HOSTS = [
  "news.google.com",
  "www.news.google.com",
];

const GOOGLE_INFRASTRUCTURE_HOSTS = [
  "lh3.googleusercontent.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
  "lh6.googleusercontent.com",
  "googleusercontent.com",
  "gstatic.com",
];

const RSS_FEEDS = [
  "https://news.google.com/rss/search?q=%22rogue+AI%22&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=%22AI+agent%22+hack&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=%22AI+agent%22+%22unauthorized%22&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=%22AI+agent%22+%22unexpected+behavior%22&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=%22AI+model%22+%22went+rogue%22&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=%22AI+agent%22+%22safety+incident%22&hl=en-US&gl=US&ceid=US:en",
];

const KEYWORDS: Record<
  string,
  number
> = {
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

/*
 * ----------------------------------------------------------
 * General text helpers
 * ----------------------------------------------------------
 */

function cleanText(
  text: string
): string {
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
  if (
    text.length <=
    maxCharacters
  ) {
    return text;
  }

  return (
    text.slice(
      0,
      maxCharacters
    ) +
    "\n\n[ARTICLE TEXT TRUNCATED]"
  );
}

function decodeHtmlEntities(
  text: string
): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

/*
 * ----------------------------------------------------------
 * URL helpers
 * ----------------------------------------------------------
 */

function getDomain(
  url: string
): string {
  try {
    return new URL(url)
      .hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

function isGoogleNewsUrl(
  url: string
): boolean {
  try {
    const hostname =
      new URL(url)
        .hostname
        .toLowerCase();

    return (
      hostname ===
        "news.google.com" ||
      hostname.endsWith(
        ".news.google.com"
      )
    );
  } catch {
    return false;
  }
}

function isGoogleInfrastructureUrl(
  url: string
): boolean {
  const hostname =
    getDomain(url);

  if (!hostname) {
    return false;
  }

  return GOOGLE_INFRASTRUCTURE_HOSTS.some(
    (host) =>
      hostname === host ||
      hostname.endsWith(
        `.${host}`
      )
  );
}

function isValidPublisherUrl(
  url: string | null
): boolean {
  if (!url) {
    return false;
  }

  try {
    const parsed =
      new URL(url);

    if (
      parsed.protocol !==
      "http:" &&
      parsed.protocol !==
      "https:"
    ) {
      return false;
    }

    if (
      isGoogleNewsUrl(url)
    ) {
      return false;
    }

    if (
      isGoogleInfrastructureUrl(
        url
      )
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function isTrustedSource(
  url: string
): boolean {
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

/*
 * ----------------------------------------------------------
 * Relevance scoring
 * ----------------------------------------------------------
 */

function calculateRelevance(
  title: string,
  summary: string
) {
  const text =
    `${title} ${summary}`.toLowerCase();

  let score = 0;

  const matchedKeywords: string[] =
    [];

  for (
    const [
      keyword,
      weight,
    ] of Object.entries(
      KEYWORDS
    )
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
    score: Math.min(
      score,
      100
    ),

    matchedKeywords,
  };
}

/*
 * ----------------------------------------------------------
 * Article text validation
 * ----------------------------------------------------------
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

  if (
    cleaned
      .toLowerCase()
      .includes(
        GOOGLE_NEWS_BOILERPLATE.toLowerCase()
      )
  ) {
    return false;
  }

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

  return (
    signalCount >= 2
  );
}

/*
 * ----------------------------------------------------------
 * Basic HTTP fetch
 * ----------------------------------------------------------
 */

async function fetchHtml(
  url: string,
  timeoutMs = 15000
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
            timeoutMs
          ),
      });

    if (!response.ok) {
      console.warn(
        `HTTP ${response.status} while fetching ${url}`
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

/*
 * ----------------------------------------------------------
 * Google News URL resolution
 * ----------------------------------------------------------
 *
 * Google News RSS article links are encoded:
 *
 * https://news.google.com/rss/articles/CBMi...
 *
 * A normal HTTP redirect is NOT reliable for these URLs.
 *
 * We therefore:
 *
 * 1. Extract the Google article ID.
 * 2. Fetch Google's article page.
 * 3. Read data-n-a-id, data-n-a-sg and data-n-a-ts.
 * 4. Call Google's Fbv4je batchexecute RPC.
 * 5. Extract the real publisher URL.
 *
 * This follows the same general mechanism used by
 * current Google News URL decoder implementations.
 */

function extractGoogleNewsArticleId(
  url: string
): string | null {
  try {
    const parsed =
      new URL(url);

    const segments =
      parsed.pathname
        .split("/")
        .filter(Boolean);

    const articleIndex =
      segments.findIndex(
        (segment) =>
          segment ===
            "articles" ||
          segment ===
            "read"
      );

    if (
      articleIndex >= 0 &&
      segments[
        articleIndex + 1
      ]
    ) {
      return decodeURIComponent(
        segments[
          articleIndex + 1
        ]
      );
    }

    return null;
  } catch {
    return null;
  }
}

function extractGoogleDecodeParams(
  html: string,
  articleId: string
): {
  id: string;
  signature: string;
  timestamp: string;
} | null {
  /*
   * Google normally exposes these attributes on:
   *
   * <c-wiz>
   *   <div
   *     data-n-a-id="..."
   *     data-n-a-sg="..."
   *     data-n-a-ts="..."
   *   >
   */

  const escapedId =
    articleId.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

  const patterns = [
    new RegExp(
      `<[^>]*data-n-a-id=["']${escapedId}["'][^>]*data-n-a-sg=["']([^"']+)["'][^>]*data-n-a-ts=["']([^"']+)["'][^>]*>`,
      "i"
    ),

    new RegExp(
      `<[^>]*data-n-a-id=["']${escapedId}["'][^>]*data-n-a-ts=["']([^"']+)["'][^>]*data-n-a-sg=["']([^"']+)["'][^>]*>`,
      "i"
    ),
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      html.match(pattern);

    if (
      match?.[1] &&
      match?.[2]
    ) {
      /*
       * The second pattern reverses signature and
       * timestamp, so determine which one is numeric.
       */
      const first =
        match[1];

      const second =
        match[2];

      if (
        /^\d+$/.test(
          first
        )
      ) {
        return {
          id: articleId,
          timestamp: first,
          signature: second,
        };
      }

      return {
        id: articleId,
        signature: first,
        timestamp: second,
      };
    }
  }

  /*
   * More flexible fallback. This handles cases where
   * attributes are not in the exact expected order.
   */
  const divMatches =
    html.matchAll(
      /<div\b[^>]*data-n-a-id=["']([^"']+)["'][^>]*>/gi
    );

  for (
    const match of divMatches
  ) {
    const tag =
      match[0];

    if (
      match[1] !==
      articleId
    ) {
      continue;
    }

    const signature =
      tag.match(
        /data-n-a-sg=["']([^"']+)["']/i
      )?.[1];

    const timestamp =
      tag.match(
        /data-n-a-ts=["']([^"']+)["']/i
      )?.[1];

    if (
      signature &&
      timestamp
    ) {
      return {
        id: articleId,
        signature,
        timestamp,
      };
    }
  }

  return null;
}

function extractDecodedUrlFromBatchResponse(
  responseText: string
): string | null {
  try {
    /*
     * Google wraps the RPC response in an anti-XSSI
     * prefix and one or more newline-delimited payloads.
     */
    const sections =
      responseText.split(
        "\n\n"
      );

    for (
      const section of sections
    ) {
      if (
        !section ||
        !section.includes(
          "Fbv4je"
        )
      ) {
        continue;
      }

      /*
       * The first JSON object in the section normally
       * contains the RPC result.
       */
      let outer: unknown;

      try {
        outer =
          JSON.parse(section);
      } catch {
        continue;
      }

      if (
        !Array.isArray(outer)
      ) {
        continue;
      }

      for (
        const row of outer
      ) {
        if (
          !Array.isArray(row)
        ) {
          continue;
        }

        /*
         * Common shape:
         *
         * [
         *   ...,
         *   ...,
         *   "JSON STRING"
         * ]
         */
        for (
          const value of row
        ) {
          if (
            typeof value !==
            "string"
          ) {
            continue;
          }

          if (
            !value.includes(
              "http"
            )
          ) {
            continue;
          }

          try {
            const parsed =
              JSON.parse(
                value
              );

            const candidate =
              findFirstExternalUrl(
                parsed
              );

            if (
              isValidPublisherUrl(
                candidate
              )
            ) {
              return candidate;
            }
          } catch {
            /*
             * The string may not itself be JSON.
             * Try direct URL extraction below.
             */
          }

          const urls =
            value.match(
              /https?:\/\/[^\s"'\\]+/g
            ) || [];

          for (
            const candidate of urls
          ) {
            const cleaned =
              candidate.replace(
                /[\\"]+$/g,
                ""
              );

            if (
              isValidPublisherUrl(
                cleaned
              )
            ) {
              return cleaned;
            }
          }
        }
      }
    }
  } catch {
    /*
     * Fall through to regex-based extraction.
     */
  }

  /*
   * Last-resort extraction from the entire response.
   */
  const urls =
    responseText.match(
      /https?:\/\/[^\s"'\\]+/g
    ) || [];

  for (
    const candidate of urls
  ) {
    const cleaned =
      candidate.replace(
        /[\\"]+$/g,
        ""
      );

    if (
      isValidPublisherUrl(
        cleaned
      )
    ) {
      return cleaned;
    }
  }

  return null;
}

function findFirstExternalUrl(
  value: unknown
): string | null {
  if (
    typeof value ===
    "string"
  ) {
    if (
      isValidPublisherUrl(
        value
      )
    ) {
      return value;
    }

    return null;
  }

  if (
    Array.isArray(value)
  ) {
    for (
      const item of value
    ) {
      const result =
        findFirstExternalUrl(
          item
        );

      if (result) {
        return result;
      }
    }

    return null;
  }

  if (
    typeof value ===
      "object" &&
    value !== null
  ) {
    for (
      const item of Object.values(
        value
      )
    ) {
      const result =
        findFirstExternalUrl(
          item
        );

      if (result) {
        return result;
      }
    }
  }

  return null;
}

async function resolveGoogleNewsUrl(
  googleNewsUrl: string
): Promise<string | null> {
  if (
    !isGoogleNewsUrl(
      googleNewsUrl
    )
  ) {
    return isValidPublisherUrl(
      googleNewsUrl
    )
      ? googleNewsUrl
      : null;
  }

  const articleId =
    extractGoogleNewsArticleId(
      googleNewsUrl
    );

  if (!articleId) {
    console.warn(
      "Could not extract Google News article ID:",
      googleNewsUrl
    );

    return null;
  }

  /*
   * Google has used both /articles/ and /rss/articles/
   * endpoints for these pages. Try the cleaner article
   * endpoint first.
   */
  const googleArticleUrls = [
    `https://news.google.com/articles/${encodeURIComponent(
      articleId
    )}?hl=en-US&gl=US&ceid=US:en`,

    `https://news.google.com/rss/articles/${encodeURIComponent(
      articleId
    )}?hl=en-US&gl=US&ceid=US:en`,
  ];

  let params:
    | {
        id: string;
        signature: string;
        timestamp: string;
      }
    | null = null;

  for (
    const googleArticleUrl of googleArticleUrls
  ) {
    const response =
      await fetchHtml(
        googleArticleUrl,
        15000
      );

    if (!response) {
      continue;
    }

    params =
      extractGoogleDecodeParams(
        response.html,
        articleId
      );

    if (params) {
      break;
    }
  }

  if (!params) {
    console.warn(
      "Could not obtain Google News decoding parameters:",
      googleNewsUrl
    );

    return null;
  }

  /*
   * Construct the Fbv4je request.
   *
   * This is Google's internal RPC used by current
   * Google News URL decoders.
   */
  const innerRequest =
    JSON.stringify([
      "garturlreq",
      [
        [
          "en-US",
          "US",
          [
            "FINANCE_TOP_INDICES",
            "WEB_TEST_1_0_0",
          ],
          null,
          null,
          1,
          1,
          "US:en",
          null,
          1,
          null,
          null,
          null,
          null,
          null,
          0,
          1,
        ],
        "en-US",
        "US",
        1,
        [1, 1, 1],
        1,
        1,
        null,
        0,
        0,
        null,
        0,
      ],
      params.id,
      Number(
        params.timestamp
      ),
      params.signature,
    ]);

  const rpcPayload =
    JSON.stringify([
      [
        [
          "Fbv4je",
          innerRequest,
          null,
          "generic",
        ],
      ],
    ]);

  try {
    const response =
      await fetch(
        "https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded;charset=UTF-8",

            "User-Agent":
              USER_AGENT,

            Accept:
              "*/*",

            "Accept-Language":
              "en-US,en;q=0.9",

            Origin:
              "https://news.google.com",

            Referer:
              `https://news.google.com/articles/${encodeURIComponent(
                articleId
              )}`,
          },

          body:
            `f.req=${encodeURIComponent(
              rpcPayload
            )}`,

          signal:
            AbortSignal.timeout(
              15000
            ),
        }
      );

    if (!response.ok) {
      console.warn(
        `Google News decoder returned ${response.status}: ${googleNewsUrl}`
      );

      return null;
    }

    const responseText =
      await response.text();

    const decodedUrl =
      extractDecodedUrlFromBatchResponse(
        responseText
      );

    if (
      !isValidPublisherUrl(
        decodedUrl
      )
    ) {
      console.warn(
        "Google News decoder returned no valid publisher URL:",
        googleNewsUrl
      );

      return null;
    }

    return decodedUrl;
  } catch (error) {
    console.warn(
      "Google News URL resolution failed:",
      error
    );

    return null;
  }
}

/*
 * ----------------------------------------------------------
 * HTML article extraction
 * ----------------------------------------------------------
 */

function htmlToText(
  html: string
): string {
  let text = html;

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

  text = text.replace(
    /<\/(p|article|section|div|li|h1|h2|h3|h4|h5|blockquote|br)>/gi,
    "\n"
  );

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

function extractJsonLd(
  html: string
): unknown[] {
  const results: unknown[] =
    [];

  const matches =
    html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
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
      results.push(
        JSON.parse(raw)
      );
    } catch {
      /*
       * Ignore malformed JSON-LD.
       */
    }
  }

  return results;
}

function findArticleBodyInJsonLd(
  value: unknown
): string | null {
  if (!value) {
    return null;
  }

  if (
    Array.isArray(value)
  ) {
    for (
      const item of value
    ) {
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
    typeof value !==
      "object" ||
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

      if (
        text.length >=
          100 &&
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

/*
 * ----------------------------------------------------------
 * Article fetching
 * ----------------------------------------------------------
 */

async function fetchArticleContent(
  publisherUrl: string,
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
  /*
   * IMPORTANT:
   *
   * This function only receives a real publisher URL.
   * Google News URLs are deliberately rejected before
   * this point.
   */
  if (
    !isValidPublisherUrl(
      publisherUrl
    )
  ) {
    return {
      text: null,
      source: "failed",
      status: "failed",
      resolvedUrl:
        publisherUrl,
    };
  }

  const response =
    await fetchHtml(
      publisherUrl
    );

  if (!response) {
    /*
     * RSS summary is only a fallback.
     * Never use Google's boilerplate as article text.
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
      const rssText =
        cleanText(
          rssSummary
        );

      return {
        text:
          truncateText(
            rssText,
            10000
          ),

        source: "rss",

        status: "partial",

        resolvedUrl:
          publisherUrl,
      };
    }

    return {
      text: null,
      source: "failed",
      status: "failed",
      resolvedUrl:
        publisherUrl,
    };
  }

  let resolvedUrl =
    response.finalUrl;

  /*
   * Never accept a Google infrastructure URL as
   * the article URL.
   */
  if (
    !isValidPublisherUrl(
      resolvedUrl
    )
  ) {
    resolvedUrl =
      publisherUrl;
  }

  const html =
    response.html;

  /*
   * --------------------------------------------------------
   * 1. JSON-LD articleBody
   * --------------------------------------------------------
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
   * --------------------------------------------------------
   * 2. <article>
   * --------------------------------------------------------
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
   * --------------------------------------------------------
   * 3. Paragraph extraction
   * --------------------------------------------------------
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
   * --------------------------------------------------------
   * 4. Metadata
   * --------------------------------------------------------
   */

  const metaText =
    extractMetaDescription(
      html
    );

  if (metaText) {
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
   * --------------------------------------------------------
   * 5. RSS fallback
   * --------------------------------------------------------
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
    const rssText =
      cleanText(
        rssSummary
      );

    return {
      text:
        truncateText(
          rssText,
          10000
        ),

      source: "rss",

      status: "partial",

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

/*
 * ----------------------------------------------------------
 * Candidate ID helper
 * ----------------------------------------------------------
 */

function createCandidateId(
  articleUrl: string,
  googleNewsUrl: string
): string {
  /*
   * crypto.randomUUID() gives us the database ID.
   *
   * Keeping this in one helper makes the field explicit
   * and avoids relying on database-generated IDs because
   * the discovery route currently sends the full candidate
   * object to Supabase.
   */
  void articleUrl;
  void googleNewsUrl;

  return crypto.randomUUID();
}

/*
 * ----------------------------------------------------------
 * Discovery
 * ----------------------------------------------------------
 */

export async function discoverCandidates(): Promise<
  DiscoveredCandidate[]
> {
  const candidates: DiscoveredCandidate[] =
    [];

  let rawCandidateCount = 0;

  let resolutionFailures = 0;

  let articleFetchSuccesses = 0;

  let articleFetchPartials = 0;

  let articleFetchFailures = 0;

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
          feed.items
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

        rawCandidateCount++;

        const googleNewsUrl =
          rawItem.link.trim();

        /*
         * ----------------------------------------------------
         * Resolve Google News → actual publisher
         * ----------------------------------------------------
         */

        let articleUrl:
          | string
          | null = null;

        if (
          isGoogleNewsUrl(
            googleNewsUrl
          )
        ) {
          articleUrl =
            await resolveGoogleNewsUrl(
              googleNewsUrl
            );

          if (
            !articleUrl
          ) {
            resolutionFailures++;

            console.warn(
              [
                "Google News URL resolution failed:",
                title,
                `googleUrl=${googleNewsUrl}`,
              ].join(" ")
            );

            /*
             * IMPORTANT:
             *
             * Do NOT save the Google News URL as article_url.
             * Doing so was the source of the previous bug.
             *
             * We skip unresolved candidates entirely rather
             * than inserting records that Gemini cannot read.
             */
            continue;
          }
        } else {
          articleUrl =
            googleNewsUrl;
        }

        /*
         * Final safety check.
         */
        if (
          !isValidPublisherUrl(
            articleUrl
          )
        ) {
          resolutionFailures++;

          console.warn(
            [
              "Invalid publisher URL:",
              title,
              `url=${articleUrl}`,
            ].join(" ")
          );

          continue;
        }

        /*
         * ----------------------------------------------------
         * Source / relevance
         * ----------------------------------------------------
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
         * ----------------------------------------------------
         * Fetch article
         * ----------------------------------------------------
         */

        const articleContent =
          await fetchArticleContent(
            articleUrl,
            summary || null
          );

        if (
          articleContent.status ===
          "success"
        ) {
          articleFetchSuccesses++;
        } else if (
          articleContent.status ===
          "partial"
        ) {
          articleFetchPartials++;
        } else {
          articleFetchFailures++;
        }

        const finalArticleUrl =
          isValidPublisherUrl(
            articleContent.resolvedUrl
          )
            ? articleContent.resolvedUrl
            : articleUrl;

        const sourceName =
          getDomain(
            finalArticleUrl
          ) ||
          rawItem.source?.name ||
          "Unknown";

        const candidate: DiscoveredCandidate =
          {
            id:
              createCandidateId(
                finalArticleUrl,
                googleNewsUrl
              ),

            title,

            /*
             * source_url is now the actual publisher URL.
             *
             * This is what the current route expects.
             */
            source_url:
              finalArticleUrl,

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
          };

        candidates.push(
          candidate
        );

        console.log(
          [
            "Candidate discovered:",
            title,
            `source=${sourceName}`,
            `url=${finalArticleUrl}`,
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
   * Deduplicate
   * ----------------------------------------------------------
   *
   * We ONLY reach this point with a validated publisher URL.
   *
   * Therefore a Google image URL or Google News URL cannot
   * collapse hundreds of candidates into one record.
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

  console.log(
    [
      "Discovery complete.",
      `Raw candidates: ${rawCandidateCount}.`,
      `Resolved candidates: ${candidates.length}.`,
      `Unique candidates: ${unique.length}.`,
      `Resolution failures: ${resolutionFailures}.`,
      `Article fetch success: ${articleFetchSuccesses}.`,
      `Article fetch partial: ${articleFetchPartials}.`,
      `Article fetch failed: ${articleFetchFailures}.`,
    ].join(" ")
  );

  return unique;
}