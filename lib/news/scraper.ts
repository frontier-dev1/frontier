import Parser from "rss-parser";

type FeedItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  contentSnippet?: string;
  content?: string;
  creator?: string;
  source?: {
    name?: string;
  };
};

export type DiscoveredNews = {
  title: string;

  source_url: string;

  article_url: string;

  source_name: string;

  summary: string | null;

  published_at: string | null;

  discovered_at: string;

  article_text: string | null;

  article_text_source: string | null;

  article_text_fetched_at: string | null;

  article_text_length: number;

  article_fetch_status:
    | "success"
    | "partial"
    | "failed";

  relevance_score: number;

  matched_keywords: string[];
};

const parser = new Parser();

/*
 * ----------------------------------------------------------
 * RSS feeds
 * ----------------------------------------------------------
 *
 * These are intentionally broader than the incident feeds.
 *
 * The purpose of this scraper is to discover meaningful AI
 * news, not only AI safety incidents.
 */

const NEWS_RSS_FEEDS = [
  "https://news.google.com/rss/search?q=artificial+intelligence&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=AI+models&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=AI+agents&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=generative+AI&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=AI+research&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=AI+industry&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=AI+robotics&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=AI+chips&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=AI+regulation&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=OpenAI+OR+Anthropic+OR+Google+AI&hl=en-US&gl=US&ceid=US:en",
];

/*
 * ----------------------------------------------------------
 * Relevance keywords
 * ----------------------------------------------------------
 *
 * This is only a lightweight discovery filter.
 *
 * Gemini will make the final editorial decision later.
 */

const KEYWORDS: Record<string, number> = {
  "artificial intelligence": 20,
  "artificial intelligence model": 20,
  "AI model": 15,
  "AI models": 15,
  "generative AI": 20,
  "AI agent": 20,
  "AI agents": 20,

  "machine learning": 10,

  "OpenAI": 20,
  "Anthropic": 20,
  "Google AI": 20,
  "Google DeepMind": 20,
  "DeepMind": 20,
  "Meta AI": 20,
  "Microsoft AI": 20,
  "xAI": 20,
  "NVIDIA": 15,

  "AI research": 15,
  "AI safety": 20,
  "AI regulation": 20,
  "AI policy": 20,

  "large language model": 20,
  "language model": 15,

  "robotics": 10,
  "AI chip": 15,
  "AI chips": 15,

  "benchmark": 10,
  "reasoning model": 20,
  "foundation model": 20,
};

/*
 * ----------------------------------------------------------
 * Trusted sources
 * ----------------------------------------------------------
 */

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
  "blog.google",
  "ai.meta.com",
  "microsoft.com",
  "nvidia.com",
];

/*
 * ----------------------------------------------------------
 * Helpers
 * ----------------------------------------------------------
 */

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

function cleanText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
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

/*
 * ----------------------------------------------------------
 * Relevance scoring
 * ----------------------------------------------------------
 */

function calculateRelevance(
  title: string,
  summary: string | null
) {
  const text =
    `${title} ${summary ?? ""}`.toLowerCase();

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
 * ----------------------------------------------------------
 * Google News URL detection
 * ----------------------------------------------------------
 */

function isGoogleNewsUrl(url: string): boolean {
  try {
    const hostname = new URL(url)
      .hostname
      .toLowerCase();

    return (
      hostname === "news.google.com" ||
      hostname.endsWith(".news.google.com")
    );
  } catch {
    return false;
  }
}

/**
 * ----------------------------------------------------------
 * Decode Google News RSS article URL
 * ----------------------------------------------------------
 *
 * Current Google News RSS feeds return URLs such as:
 *
 * https://news.google.com/rss/articles/CBMi...
 *
 * These are not normal HTTP redirects anymore.
 *
 * We have to ask Google's internal batchexecute endpoint
 * for the actual publisher URL.
 *
 * This is based on the current Google News URL resolution
 * mechanism used by several maintained open-source decoders.
 */

async function decodeGoogleNewsUrl(
  googleUrl: string
): Promise<string | null> {
  try {
    const parsed = new URL(
      googleUrl
    );

    const pathMatch =
      parsed.pathname.match(
        /\/(?:rss\/)?articles\/([^/?]+)/i
      );

    if (!pathMatch?.[1]) {
      return null;
    }

    const articleId =
      pathMatch[1];

    /*
     * First fetch the Google News article page.
     *
     * Google embeds the parameters required by its
     * batchexecute endpoint in the page.
     */

    const response =
      await fetch(googleUrl, {
        method: "GET",
        redirect: "follow",

        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/136 Safari/537.36",

          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

          "Accept-Language":
            "en-US,en;q=0.9",
        },

        signal:
          AbortSignal.timeout(10000),
      });

    if (!response.ok) {
      console.warn(
        `Google News page returned ${response.status}: ${googleUrl}`
      );

      return null;
    }

    const html =
      await response.text();

    /*
     * ------------------------------------------------------
     * Method 1: Current data-p format
     * ------------------------------------------------------
     */

    const dataPMatch =
      html.match(
        /<c-wiz[^>]+data-p=["']([^"']+)["']/i
      );

    if (dataPMatch?.[1]) {
      try {
        const rawDataP =
          dataPMatch[1]
            .replace(
              /&quot;/g,
              '"'
            )
            .replace(
              /&#39;/g,
              "'"
            )
            .replace(
              /&amp;/g,
              "&"
            );

        /*
         * Google uses a serialized structure beginning
         * with %.@.
         */

        const normalized =
          rawDataP.startsWith(
            "%.@."
          )
            ? rawDataP.replace(
                "%.@.",
                "[\"garturlreq\","
              ) + "]"
            : rawDataP;

        let parsedData: unknown;

        try {
          parsedData =
            JSON.parse(
              normalized
            );
        } catch {
          /*
           * Some versions return the serialized data
           * with escaped quotes.
           */

          parsedData =
            JSON.parse(
              normalized.replace(
                /\\"/g,
                '"'
              )
            );
        }

        if (
          Array.isArray(
            parsedData
          )
        ) {
          /*
           * Google expects the request object without
           * the final unused fields.
           *
           * The exact structure changes occasionally,
           * so we preserve the Google-provided array
           * and inject the article ID.
           */

          const requestData =
            parsedData.slice();

          /*
           * Find the first nested array that can contain
           * the article ID.
           */

          let replaced = false;

          function replaceId(
            value: unknown
          ): unknown {
            if (
              Array.isArray(
                value
              )
            ) {
              return value.map(
                (item) =>
                  replaceId(
                    item
                  )
              );
            }

            if (
              typeof value ===
                "string" &&
              value ===
                articleId
            ) {
              replaced = true;
            }

            return value;
          }

          replaceId(
            requestData
          );

          /*
           * If the Google page did not expose a usable
           * request structure, fall through to Method 2.
           */

          if (replaced) {
            const payload =
              JSON.stringify([
                [
                  [
                    "Fbv4je",
                    JSON.stringify(
                      requestData
                    ),
                    null,
                    "generic",
                  ],
                ],
              ]);

            const batchResponse =
              await fetch(
                "https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je",
                {
                  method: "POST",

                  headers: {
                    "Content-Type":
                      "application/x-www-form-urlencoded;charset=UTF-8",

                    "User-Agent":
                      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/136 Safari/537.36",

                    Referer:
                      "https://news.google.com/",
                  },

                  body:
                    `f.req=${encodeURIComponent(
                      payload
                    )}`,

                  signal:
                    AbortSignal.timeout(
                      10000
                    ),
                }
              );

            if (
              batchResponse.ok
            ) {
              const batchText =
                await batchResponse.text();

              const decoded =
                extractDecodedGoogleUrl(
                  batchText
                );

              if (
                decoded &&
                !isGoogleNewsUrl(
                  decoded
                )
              ) {
                return decoded;
              }
            }
          }
        }
      } catch (error) {
        console.warn(
          "Google News data-p decoder failed:",
          error
        );
      }
    }

    /*
     * ------------------------------------------------------
     * Method 2: data-n-a-id / signature / timestamp
     * ------------------------------------------------------
     *
     * Google has used this format in some versions of
     * the article page.
     */

    const signatureMatch =
      html.match(
        /data-n-a-sg=["']([^"']+)["']/i
      );

    const timestampMatch =
      html.match(
        /data-n-a-ts=["']([^"']+)["']/i
      );

    const idMatch =
      html.match(
        /data-n-a-id=["']([^"']+)["']/i
      );

    if (
      signatureMatch?.[1] &&
      timestampMatch?.[1]
    ) {
      const id =
        idMatch?.[1] ??
        articleId;

      const requestObject = [
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
            180,
            null,
            null,
            null,
            null,
            0,
            null,
            null,
            [
              1608992183,
              723341000,
            ],
          ],
          "en-US",
          "US",
          1,
          [
            2,
            3,
            4,
            8,
          ],
          1,
          0,
          "655000234",
          0,
          0,
          null,
          null,
        ],
        id,
        timestampMatch[1],
        signatureMatch[1],
      ];

      const payload =
        JSON.stringify([
          [
            [
              "Fbv4je",
              JSON.stringify(
                requestObject
              ),
              null,
              "generic",
            ],
          ],
        ]);

      const batchResponse =
        await fetch(
          "https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded;charset=UTF-8",

              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/136 Safari/537.36",

              Referer:
                "https://news.google.com/",
            },

            body:
              `f.req=${encodeURIComponent(
                payload
              )}`,

            signal:
              AbortSignal.timeout(
                10000
              ),
          }
        );

      if (
        batchResponse.ok
      ) {
        const batchText =
          await batchResponse.text();

        const decoded =
          extractDecodedGoogleUrl(
            batchText
          );

        if (
          decoded &&
          !isGoogleNewsUrl(
            decoded
          )
        ) {
          return decoded;
        }
      }
    }

    /*
     * ------------------------------------------------------
     * Method 3: Old-style base64/protobuf URL
     * ------------------------------------------------------
     *
     * Some older Google News links can still contain
     * the original URL directly in the encoded payload.
     */

    try {
      const decoded =
        Buffer.from(
          articleId,
          "base64url"
        ).toString(
          "utf8"
        );

      const urlMatch =
        decoded.match(
          /https?:\/\/[^\s"\\]+/
        );

      if (
        urlMatch?.[0] &&
        !isGoogleNewsUrl(
          urlMatch[0]
        )
      ) {
        return urlMatch[0];
      }
    } catch {
      // Ignore old-format decoding failures.
    }

    return null;
  } catch (error) {
    console.warn(
      `Unable to decode Google News URL ${googleUrl}:`,
      error
    );

    return null;
  }
}

/**
 * Extract the publisher URL from Google's batchexecute
 * response.
 */

function extractDecodedGoogleUrl(
  responseText: string
): string | null {
  try {
    /*
     * Most responses contain:
     *
     * ["garturlres","https://publisher.com/article",...]
     */

    const directMatch =
      responseText.match(
        /\[\\"garturlres\\",\\"(https?:\/\/[^"\\]+)/
      );

    if (
      directMatch?.[1]
    ) {
      return directMatch[1]
        .replace(
          /\\u003d/g,
          "="
        )
        .replace(
          /\\u0026/g,
          "&"
        )
        .replace(
          /\\\//g,
          "/"
        );
    }

    /*
     * Fallback: search for any publisher URL in the
     * batchexecute response that isn't Google.
     */

    const urlMatches =
      responseText.match(
        /https?:\\?\/\\?\/[^\s"'\\]+/g
      ) ?? [];

    for (
      const rawUrl of urlMatches
    ) {
      const url =
        rawUrl
          .replace(
            /\\u003d/g,
            "="
          )
          .replace(
            /\\u0026/g,
            "&"
          )
          .replace(
            /\\\//g,
            "/"
          )
          .replace(
            /\\/g,
            ""
          );

      if (
        /^https?:\/\//i.test(
          url
        ) &&
        !isGoogleNewsUrl(
          url
        ) &&
        !url.includes(
          "google.com"
        ) &&
        !url.includes(
          "gstatic.com"
        )
      ) {
        return url;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * ----------------------------------------------------------
 * Resolve article URL
 * ----------------------------------------------------------
 */

async function resolveUrl(
  url: string
): Promise<string> {
  /*
   * Regular publisher URL.
   */

  if (
    !isGoogleNewsUrl(url)
  ) {
    return url;
  }

  /*
   * Google News RSS article URL.
   */

  const decoded =
    await decodeGoogleNewsUrl(
      url
    );

  if (
    decoded &&
    !isGoogleNewsUrl(
      decoded
    )
  ) {
    console.log(
      `Resolved Google News URL:\n${url}\n→ ${decoded}`
    );

    return decoded;
  }

  console.warn(
    `Could not resolve Google News URL: ${url}`
  );

  /*
   * Keep the original URL as a final fallback.
   */

  return url;
}

/*
 * ----------------------------------------------------------
 * JSON-LD extraction
 * ----------------------------------------------------------
 */

function extractJsonLd(
  html: string
): string[] {
  const results: string[] = [];

  const matches = html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const match of matches) {
    const raw = match[1]?.trim();

    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw);

      const objects = Array.isArray(parsed)
        ? parsed
        : [parsed];

      for (const object of objects) {
        if (
          !object ||
          typeof object !== "object"
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
          results.push(articleBody);
        }

        if (
          description &&
          description.length > 100
        ) {
          results.push(description);
        }

        if (
          headline &&
          headline.length > 20
        ) {
          results.push(headline);
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

/*
 * ----------------------------------------------------------
 * Meta extraction
 * ----------------------------------------------------------
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

  for (const pattern of patterns) {
    const matches = html.matchAll(pattern);

    for (const match of matches) {
      if (match[1]) {
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

/*
 * ----------------------------------------------------------
 * HTML article extraction
 * ----------------------------------------------------------
 */

function extractHtmlArticleText(
  html: string
): string {
  let text = html;

  /*
   * Remove elements that almost never contain
   * useful article content.
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
    /<\/(p|article|section|div|li|h1|h2|h3|h4|blockquote)>/gi,
    "\n"
  );

  /*
   * Remove remaining HTML.
   */

  text = text.replace(
    /<[^>]+>/g,
    " "
  );

  text = decodeHtmlEntities(text);

  return cleanText(text);
}

/*
 * ----------------------------------------------------------
 * Article quality scoring
 * ----------------------------------------------------------
 */

function scoreArticleText(
  text: string
): number {
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
    "announced",
    "launch",
    "released",
  ];

  let score = 0;

  for (const signal of usefulSignals) {
    if (
      lower.includes(signal)
    ) {
      score += 1;
    }
  }

  if (text.length >= 1000) {
    score += 3;
  }

  if (text.length >= 3000) {
    score += 3;
  }

  if (text.length >= 6000) {
    score += 2;
  }

  return score;
}

/**
 * ----------------------------------------------------------
 * Google News boilerplate detection
 * ----------------------------------------------------------
 */

const GOOGLE_NEWS_BOILERPLATE =
  "Comprehensive up-to-date news coverage, aggregated from sources all over the world by Google News.";

function isGoogleNewsBoilerplate(
  text: string | null | undefined
): boolean {
  if (!text) {
    return false;
  }

  const normalized =
    text
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  return normalized.includes(
    GOOGLE_NEWS_BOILERPLATE.toLowerCase()
  );
}

/*
 * ----------------------------------------------------------
 * Fetch article content
 * ----------------------------------------------------------
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
  /*
   * Never attempt to treat a Google News wrapper page
   * as an article.
   */

  if (
    isGoogleNewsUrl(url)
  ) {
    console.warn(
      `Skipping article fetch because URL is still a Google News wrapper: ${url}`
    );

    /*
     * Do NOT use the Google News RSS summary if it is
     * just Google's generic boilerplate.
     */

    if (
      rssSummary &&
      rssSummary.trim().length >= 100 &&
      !isGoogleNewsBoilerplate(
        rssSummary
      )
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

  try {
    const response =
      await fetch(url, {
        method: "GET",
        redirect: "follow",

        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/136 Safari/537.36",

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
        `News article fetch returned ${response.status}: ${url}`
      );
    } else {
      /*
       * If the publisher redirects us back to Google News,
       * don't treat the result as an article.
       */

      if (
        isGoogleNewsUrl(
          response.url
        )
      ) {
        console.warn(
          `Publisher request redirected back to Google News: ${url}`
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
           * FIRST: JSON-LD
           */

          const jsonLd =
            extractJsonLd(html);

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
            ) >= 3 &&
            !isGoogleNewsBoilerplate(
              jsonLdText
            )
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
           * SECOND: normal HTML
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
            ) >= 3 &&
            !isGoogleNewsBoilerplate(
              htmlText
            )
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
           * THIRD: metadata
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
              100 &&
            !isGoogleNewsBoilerplate(
              metaText
            )
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
    }
  } catch (error) {
    console.warn(
      `Unable to fetch news article ${url}:`,
      error
    );
  }

  /*
   * FOURTH: RSS fallback.
   *
   * Only use RSS content if it is actually article-like.
   */

  /*
   * FOURTH: RSS fallback.
   */

  if (
    rssSummary &&                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           
    rssSummary.trim().length >= 100
  ) {
    return {
      text:
        rssSummary
          .trim()
          .slice(0, 10000),

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
};

/*
 * ----------------------------------------------------------
 * Discover news
 * ----------------------------------------------------------
 */

export async function discoverNews(): Promise<
  DiscoveredNews[]
> {
  const candidates: DiscoveredNews[] = [];

  const discoveredAt =
    new Date().toISOString();

  for (const feedUrl of NEWS_RSS_FEEDS) {
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

        const rawSummary =
          (
            rawItem.contentSnippet ??
            rawItem.content ??
            ""
          ).trim();
        
        const summary =
          isGoogleNewsBoilerplate(
            rawSummary
        ) 
          ? null
          : rawSummary;

        /*
         * Lightweight discovery relevance.
         *
         * Gemini will make the actual editorial
         * decision later.
         */

        const relevance =
          calculateRelevance(
            title,
            summary
          );

        if (
          relevance.score < 15
        ) {
          continue;
        }

        /*
         * Resolve Google News to the actual article.
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
                relevance.score + 10,
                100
              )
            : relevance.score;

        /*
         * Fetch article text.
         */

        const articleContent =
          await fetchArticleContent(
            articleUrl,
            summary || null
          );

        candidates.push({
          title,

          source_url:
            rawItem.link,

          article_url:
            articleUrl,

          source_name:
            rawItem.source?.name?.trim() ||
            getDomain(articleUrl) ||
            "Unknown",

          summary:
            summary || null,

          published_at:
            rawItem.isoDate ||
            rawItem.pubDate
              ? new Date(
                  rawItem.isoDate ??
                    rawItem.pubDate!
                ).toISOString()
              : null,

          discovered_at:
            discoveredAt,

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

          relevance_score:
            finalScore,

          matched_keywords:
            relevance.matchedKeywords,
        });
      }
    } catch (error) {
      console.error(
        `Failed to process news feed ${feedUrl}:`,
        error
      );
    }
  }

  /*
   * Deduplicate by final article URL.
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
    `News discovery complete. Raw candidates: ${candidates.length}. Unique candidates: ${unique.length}.`
  );

  return unique;
}