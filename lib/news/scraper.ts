import Parser from "rss-parser";

/*
 * ============================================================
 * Frontier AI News Discovery Scraper
 * ============================================================
 *
 * Architecture:
 *
 *   Direct publisher RSS
 *          ↓
 *   Publisher article URL
 *          ↓
 *   Fetch article HTML
 *          ↓
 *   Extract article text
 *          ↓
 *   Quality check
 *          ↓
 *   Candidate
 *          ↓
 *   Gemini editorial review
 *
 * IMPORTANT:
 *
 * Google News is NOT used as the primary discovery source.
 *
 * Google News RSS URLs frequently return wrapper URLs and
 * Google News boilerplate instead of the actual article.
 * ============================================================
 */

/*
 * ============================================================
 * Configuration
 * ============================================================
 */

const USER_AGENT =
  "Mozilla/5.0 (compatible; Frontier AI News Research Bot/1.0; +https://frontier-eight.vercel.app/)";

const MAX_ARTICLE_LENGTH = 50000;

const MIN_ARTICLE_LENGTH = 500;

const FETCH_TIMEOUT_MS = 15000;

/*
 * ============================================================
 * RSS parser
 * ============================================================
 */

const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
});

/*
 * ============================================================
 * Types
 * ============================================================
 */

type FeedItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;

  contentSnippet?: string;
  content?: string;
  contentEncoded?: string;

  creator?: string;
  author?: string;

  categories?: string[];

  guid?: string;
};

type FeedSource = {
  name: string;
  url: string;
};

export type ArticleFetchResult = {
  text: string | null;

  source:
    | "json_ld"
    | "article"
    | "main"
    | "paragraphs"
    | "html"
    | "meta"
    | "rss"
    | null;

  status:
    | "success"
    | "partial"
    | "failed";

  fetchedAt: string;

  length: number;

  resolvedUrl: string | null;
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

/*
 * ============================================================
 * Direct publisher RSS feeds
 * ============================================================
 */

const NEWS_RSS_FEEDS: FeedSource[] = [
  {
    name: "BBC",
    url:
      "https://feeds.bbci.co.uk/news/technology/rss.xml",
  },

  {
    name: "Wired",
    url:
      "https://www.wired.com/feed/rss",
  },

  {
    name: "Ars Technica",
    url:
      "https://feeds.arstechnica.com/arstechnica/technology-lab",
  },

  {
    name: "MIT Technology Review",
    url:
      "https://www.technologyreview.com/feed/",
  },

  {
    name: "TechCrunch AI",
    url:
      "https://techcrunch.com/category/artificial-intelligence/feed/",
  },

  {
    name: "VentureBeat AI",
    url:
      "https://venturebeat.com/category/ai/feed/",
  },

  {
    name: "The Verge AI",
    url:
      "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
  },

  {
    name: "The Guardian Technology",
    url:
      "https://www.theguardian.com/technology/rss",
  },

  {
    name: "Google AI Blog",
    url:
      "https://blog.google/technology/ai/rss/",
  },

  {
    name: "OpenAI",
    url:
      "https://openai.com/news/rss.xml",
  },
];

/*
 * ============================================================
 * Discovery keywords
 * ============================================================
 *
 * This is intentionally only a discovery filter.
 *
 * Gemini performs the actual editorial review.
 * ============================================================
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

  "large language model": 20,
  "language model": 15,

  "foundation model": 20,
  "reasoning model": 20,
  "multimodal model": 20,

  "AI research": 15,

  "AI safety": 20,
  "AI security": 20,

  "AI regulation": 20,
  "AI policy": 20,

  "artificial general intelligence": 25,

  "autonomous agent": 20,
  "autonomous agents": 20,

  robotics: 10,

  "AI chip": 15,
  "AI chips": 15,

  "AI infrastructure": 15,
  "AI accelerator": 15,

  benchmark: 10,

  OpenAI: 20,
  Anthropic: 20,

  "Google AI": 20,
  "Google DeepMind": 20,
  DeepMind: 20,

  "Meta AI": 20,
  "Microsoft AI": 20,

  xAI: 20,
  NVIDIA: 15,

  Claude: 15,
  GPT: 15,
  Gemini: 15,
  Llama: 15,
  Mistral: 15,

  funding: 8,
  acquisition: 10,
  acquired: 10,

  "AI startup": 15,
  "AI company": 15,
};

/*
 * ============================================================
 * Trusted sources
 * ============================================================
 */

const TRUSTED_SOURCES = [
  "reuters.com",
  "apnews.com",

  "bbc.com",
  "bbc.co.uk",

  "wired.com",

  "technologyreview.com",

  "arstechnica.com",

  "techcrunch.com",

  "venturebeat.com",

  "theverge.com",

  "theguardian.com",

  "nytimes.com",

  "washingtonpost.com",

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
 * ============================================================
 * Google News boilerplate detection
 * ============================================================
 */

const GOOGLE_NEWS_BOILERPLATE =
  "Comprehensive up-to-date news coverage, aggregated from sources all over the world by Google News.";

/*
 * ============================================================
 * Helpers
 * ============================================================
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
    .replace(/&gt;/gi, ">")
    .replace(
      /&#(\d+);/g,
      (_, code) => {
        const number =
          Number(code);

        if (
          Number.isNaN(number)
        ) {
          return _;
        }

        return String.fromCharCode(
          number
        );
      }
    );
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

/*
 * ============================================================
 * Article text quality checks
 * ============================================================
 */

function isGoogleNewsBoilerplate(
  text: string
): boolean {
  return text
    .toLowerCase()
    .includes(
      GOOGLE_NEWS_BOILERPLATE.toLowerCase()
    );
}

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
    isGoogleNewsBoilerplate(
      cleaned
    )
  ) {
    return false;
  }

  return true;
}

/*
 * ============================================================
 * Relevance scoring
 * ============================================================
 */

function calculateRelevance(
  title: string,
  summary: string | null
): {
  score: number;
  matchedKeywords: string[];
} {
  const text =
    `${title} ${summary ?? ""}`.toLowerCase();

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
 * ============================================================
 * Published date
 * ============================================================
 */

function getPublishedAt(
  item: FeedItem
): string | null {
  const rawDate =
    item.isoDate ||
    item.pubDate;

  if (!rawDate) {
    return null;
  }

  const date =
    new Date(rawDate);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toISOString();
}

/*
 * ============================================================
 * RSS summary
 * ============================================================
 */

function getFeedSummary(
  item: FeedItem
): string | null {
  const candidates = [
    item.contentSnippet,
    item.contentEncoded,
    item.content,
  ];

  for (
    const candidate of candidates
  ) {
    if (
      typeof candidate !==
      "string"
    ) {
      continue;
    }

    const cleaned =
      cleanText(
        htmlToText(
          candidate
        )
      );

    if (
      cleaned.length < 20
    ) {
      continue;
    }

    if (
      isGoogleNewsBoilerplate(
        cleaned
      )
    ) {
      continue;
    }

    return cleaned;
  }

  return null;
}

/*
 * ============================================================
 * Fetch publisher article HTML
 * ============================================================
 */

async function fetchHtml(
  url: string
): Promise<{
  html: string;
  finalUrl: string;
} | null> {
  if (
    isGoogleNewsUrl(url)
  ) {
    console.warn(
      `[NEWS FETCH] Refusing to fetch Google News wrapper: ${url}`
    );

    return null;
  }

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
            FETCH_TIMEOUT_MS
          ),
      });

    const finalUrl =
      response.url || url;

    if (
      !response.ok
    ) {
      console.warn(
        `[NEWS FETCH] HTTP ${response.status}: ${url}`
      );

      return null;
    }

    if (
      isGoogleNewsUrl(
        finalUrl
      )
    ) {
      console.warn(
        `[NEWS FETCH] Redirected to Google News, rejecting: ${url}`
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
      console.warn(
        `[NEWS FETCH] Not HTML (${contentType}): ${url}`
      );

      return null;
    }

    const html =
      await response.text();

    if (
      !html ||
      html.length < 500
    ) {
      console.warn(
        `[NEWS FETCH] HTML response too short (${html.length} chars): ${url}`
      );

      return null;
    }

    return {
      html,
      finalUrl,
    };
  } catch (error) {
    console.warn(
      `[NEWS FETCH] Unable to fetch ${url}:`,
      error
    );

    return null;
  }
}

/*
 * ============================================================
 * HTML → text
 * ============================================================
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
   * Remove aside.
   */

  text = text.replace(
    /<aside\b[^>]*>[\s\S]*?<\/aside>/gi,
    " "
  );

  /*
   * Preserve paragraph boundaries.
   */

  text = text.replace(
    /<\/(p|article|main|section|div|li|h1|h2|h3|h4|h5|blockquote|br)>/gi,
    "\n"
  );

  /*
   * Remove remaining HTML tags.
   */

  text = text.replace(
    /<[^>]+>/g,
    " "
  );

  /*
   * Decode entities.
   */

  text =
    decodeHtmlEntities(
      text
    );

  return cleanText(
    text
  );
}

/*
 * ============================================================
 * JSON-LD extraction
 * ============================================================
 */

function extractJsonLdArticleBodies(
  html: string
): string[] {
  const results: string[] =
    [];

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
        Array.isArray(parsed)
          ? parsed
          : [parsed];

      for (
        const object of objects
      ) {
        collectJsonLdArticleBodies(
          object,
          results
        );
      }
    } catch {
      /*
       * Some publishers include malformed
       * JSON-LD. Ignore it.
       */
    }
  }

  return results;
}

function collectJsonLdArticleBodies(
  value: unknown,
  results: string[]
): void {
  if (!value) {
    return;
  }

  if (
    Array.isArray(value)
  ) {
    for (
      const item of value
    ) {
      collectJsonLdArticleBodies(
        item,
        results
      );
    }

    return;
  }

  if (
    typeof value !==
      "object" ||
    value === null
  ) {
    return;
  }

  const object =
    value as Record<
      string,
      unknown
    >;

  const articleBody =
    object.articleBody;

  if (
    typeof articleBody ===
      "string" &&
    isUsableArticleText(
      articleBody
    )
  ) {
    results.push(
      cleanText(
        articleBody
      )
    );
  }

  /*
   * Some pages use @graph.
   */

  if (
    object["@graph"]
  ) {
    collectJsonLdArticleBodies(
      object["@graph"],
      results
    );
  }

  /*
   * Some structured data nests
   * article information.
   */

  for (
    const valueItem of Object.values(
      object
    )
  ) {
    if (
      typeof valueItem ===
        "object" &&
      valueItem !== null
    ) {
      collectJsonLdArticleBodies(
        valueItem,
        results
      );
    }
  }
}

/*
 * ============================================================
 * <article> extraction
 * ============================================================
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

/*
 * ============================================================
 * <main> extraction
 * ============================================================
 */

function extractMainElement(
  html: string
): string | null {
  const match =
    html.match(
      /<main\b[^>]*>([\s\S]*?)<\/main>/i
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

/*
 * ============================================================
 * Paragraph extraction
 * ============================================================
 */

function extractParagraphText(
  html: string
): string | null {
  /*
   * Prefer paragraphs inside <article>.
   */

  const articleMatch =
    html.match(
      /<article\b[^>]*>([\s\S]*?)<\/article>/i
    );

  /*
   * Otherwise prefer paragraphs inside <main>.
   */

  const mainMatch =
    html.match(
      /<main\b[^>]*>([\s\S]*?)<\/main>/i
    );

  const container =
    articleMatch?.[1] ||
    mainMatch?.[1] ||
    html;

  const paragraphs =
    container.match(
      /<p\b[^>]*>[\s\S]*?<\/p>/gi
    ) || [];

  const extracted =
    paragraphs
      .map(
        (paragraph) =>
          htmlToText(
            paragraph
          )
      )
      .filter(
        (paragraph) =>
          paragraph.length >=
          40
      );

  /*
   * Don't accept a page that only has
   * one or two tiny snippets.
   */

  if (
    extracted.length < 3
  ) {
    return null;
  }

  const text =
    cleanText(
      extracted.join(
        "\n\n"
      )
    );

  return isUsableArticleText(
    text
  )
    ? text
    : null;
}

/*
 * ============================================================
 * Metadata extraction
 * ============================================================
 */

function extractMetaDescriptions(
  html: string
): string[] {
  const results: string[] =
    [];

  const patterns = [
    /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/gi,

    /<meta\b[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/gi,

    /<meta\b[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/gi,

    /<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["'][^>]*>/gi,

    /<meta\b[^>]*name=["']twitter:description["'][^>]*content=["']([^"']+)["'][^>]*>/gi,

    /<meta\b[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:description["'][^>]*>/gi,
  ];

  for (
    const pattern of patterns
  ) {
    const matches =
      html.matchAll(
        pattern
      );

    for (
      const match of matches
    ) {
      if (!match[1]) {
        continue;
      }

      const text =
        cleanText(
          decodeHtmlEntities(
            match[1]
          )
        );

      if (
        text.length >= 100 &&
        !isGoogleNewsBoilerplate(
          text
        )
      ) {
        results.push(
          text
        );
      }
    }
  }

  return results;
}

/*
 * ============================================================
 * Article text quality score
 * ============================================================
 */

function scoreArticleText(
  text: string
): number {
  const lower =
    text.toLowerCase();

  let score = 0;

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
    "technology",
  ];

  for (
    const signal of usefulSignals
  ) {
    if (
      lower.includes(signal)
    ) {
      score++;
    }
  }

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

  if (
    text.length >= 6000
  ) {
    score += 2;
  }

  return score;
}

/*
 * ============================================================
 * Choose best article text
 * ============================================================
 */

function chooseBestText(
  candidates: Array<{
    text: string;
    source:
      | "json_ld"
      | "article"
      | "main"
      | "paragraphs"
      | "html";
  }>
): {
  text: string;
  source:
    | "json_ld"
    | "article"
    | "main"
    | "paragraphs"
    | "html";
} | null {
  let best:
    | {
        text: string;
        source:
          | "json_ld"
          | "article"
          | "main"
          | "paragraphs"
          | "html";
      }
    | null = null;

  let bestScore = -1;

  for (
    const candidate of candidates
  ) {
    const text =
      cleanText(
        candidate.text
      );

    if (
      !isUsableArticleText(
        text
      )
    ) {
      continue;
    }

    const score =
      scoreArticleText(
        text
      );

    /*
     * Length matters, but quality signals
     * also matter.
     */

    const combinedScore =
      score +
      Math.min(
        text.length / 5000,
        5
      );

    if (
      combinedScore >
      bestScore
    ) {
      bestScore =
        combinedScore;

      best = {
        text,
        source:
          candidate.source,
      };
    }
  }

  return best;
}

/*
 * ============================================================
 * Fetch and extract article
 * ============================================================
 */

export async function fetchArticle(
  url: string,
  rssSummary: string | null = null
): Promise<ArticleFetchResult> {
  const fetchedAt =
    new Date().toISOString();

  /*
   * Never fetch Google News directly.
   */

  if (
    isGoogleNewsUrl(url)
  ) {
    console.warn(
      `[NEWS ARTICLE] Google News URL rejected: ${url}`
    );

    /*
     * IMPORTANT:
     *
     * Do NOT use the Google News boilerplate
     * as article text.
     */

    return {
      text: null,

      source: null,

      status:
        "failed",

      fetchedAt,

      length: 0,

      resolvedUrl: null,
    };
  }

  /*
   * ----------------------------------------------------------
   * Fetch publisher HTML
   * ----------------------------------------------------------
   */

  const response =
    await fetchHtml(
      url
    );

  if (!response) {
    /*
     * We intentionally do NOT convert an arbitrary RSS
     * snippet into article_text.
     *
     * The RSS snippet remains in `summary`.
     */

    return {
      text: null,

      source: null,

      status:
        "failed",

      fetchedAt,

      length: 0,

      resolvedUrl: url,
    };
  }

  const resolvedUrl =
    response.finalUrl ||
    url;

  const html =
    response.html;

  /*
   * ----------------------------------------------------------
   * 1. JSON-LD
   * ----------------------------------------------------------
   */

  const jsonLdBodies =
    extractJsonLdArticleBodies(
      html
    );

  const jsonLdCandidates =
    jsonLdBodies.map(
      (text) => ({
        text,
        source:
          "json_ld" as const,
      })
    );

  const jsonLdBest =
    chooseBestText(
      jsonLdCandidates
    );

  if (
    jsonLdBest &&
    jsonLdBest.text.length >=
      MIN_ARTICLE_LENGTH
  ) {
    const finalText =
      truncateText(
        jsonLdBest.text,
        MAX_ARTICLE_LENGTH
      );

    console.log(
      [
        "[NEWS ARTICLE]",
        "SUCCESS",
        `Method: JSON-LD`,
        `Length: ${finalText.length}`,
        `URL: ${resolvedUrl}`,
      ].join(" | ")
    );

    return {
      text: finalText,

      source:
        "json_ld",

      status:
        "success",

      fetchedAt,

      length:
        finalText.length,

      resolvedUrl,
    };
  }

  /*
   * ----------------------------------------------------------
   * 2. <article>
   * ----------------------------------------------------------
   */

  const articleElement =
    extractArticleElement(
      html
    );

  if (
    articleElement &&
    scoreArticleText(
      articleElement
    ) >= 3
  ) {
    const finalText =
      truncateText(
        articleElement,
        MAX_ARTICLE_LENGTH
      );

    console.log(
      [
        "[NEWS ARTICLE]",
        "SUCCESS",
        "Method: <article>",
        `Length: ${finalText.length}`,
        `URL: ${resolvedUrl}`,
      ].join(" | ")
    );

    return {
      text: finalText,

      source:
        "article",

      status:
        "success",

      fetchedAt,

      length:
        finalText.length,

      resolvedUrl,
    };
  }

  /*
   * ----------------------------------------------------------
   * 3. <main>
   * ----------------------------------------------------------
   */

  const mainElement =
    extractMainElement(
      html
    );

  if (
    mainElement &&
    scoreArticleText(
      mainElement
    ) >= 3
  ) {
    const finalText =
      truncateText(
        mainElement,
        MAX_ARTICLE_LENGTH
      );

    console.log(
      [
        "[NEWS ARTICLE]",
        "SUCCESS",
        "Method: <main>",
        `Length: ${finalText.length}`,
        `URL: ${resolvedUrl}`,
      ].join(" | ")
    );

    return {
      text: finalText,

      source:
        "main",

      status:
        "success",

      fetchedAt,

      length:
        finalText.length,

      resolvedUrl,
    };
  }

  /*
   * ----------------------------------------------------------
   * 4. Paragraph extraction
   * ----------------------------------------------------------
   */

  const paragraphText =
    extractParagraphText(
      html
    );

  if (
    paragraphText &&
    scoreArticleText(
      paragraphText
    ) >= 3
  ) {
    const finalText =
      truncateText(
        paragraphText,
        MAX_ARTICLE_LENGTH
      );

    console.log(
      [
        "[NEWS ARTICLE]",
        "SUCCESS",
        "Method: paragraphs",
        `Length: ${finalText.length}`,
        `URL: ${resolvedUrl}`,
      ].join(" | ")
    );

    return {
      text: finalText,

      source:
        "paragraphs",

      status:
        "success",

      fetchedAt,

      length:
        finalText.length,

      resolvedUrl,
    };
  }

  /*
   * ----------------------------------------------------------
   * 5. Generic HTML
   * ----------------------------------------------------------
   *
   * This is intentionally last because generic HTML extraction
   * can contain navigation, cookie banners, related articles,
   * etc.
   * ----------------------------------------------------------
   */

  const genericHtml =
    htmlToText(
      html
    );

  if (
    genericHtml.length >=
      MIN_ARTICLE_LENGTH &&
    scoreArticleText(
      genericHtml
    ) >= 8
  ) {
    const finalText =
      truncateText(
        genericHtml,
        MAX_ARTICLE_LENGTH
      );

    console.log(
      [
        "[NEWS ARTICLE]",
        "SUCCESS",
        "Method: generic HTML",
        `Length: ${finalText.length}`,
        `URL: ${resolvedUrl}`,
      ].join(" | ")
    );

    return {
      text: finalText,

      source:
        "html",

      status:
        "success",

      fetchedAt,

      length:
        finalText.length,

      resolvedUrl,
    };
  }

  /*
   * ----------------------------------------------------------
   * 6. Metadata
   * ----------------------------------------------------------
   */

  const metaDescriptions =
    extractMetaDescriptions(
      html
    );

  const metaText =
    cleanText(
      metaDescriptions.join(
        "\n\n"
      )
    );

  if (
    metaText.length >=
    100
  ) {
    console.log(
      [
        "[NEWS ARTICLE]",
        "PARTIAL",
        "Method: metadata",
        `Length: ${metaText.length}`,
        `URL: ${resolvedUrl}`,
      ].join(" | ")
    );

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

      fetchedAt,

      length:
        Math.min(
          metaText.length,
          10000
        ),

      resolvedUrl,
    };
  }

  /*
   * ----------------------------------------------------------
   * 7. Failed
   * ----------------------------------------------------------
   *
   * Do NOT use RSS summary as article_text.
   *
   * The summary is still returned separately in the
   * discovered candidate.
   * ----------------------------------------------------------
   */

  console.warn(
    [
      "[NEWS ARTICLE]",
      "FAILED",
      "No usable article text found",
      `HTML length: ${html.length}`,
      `URL: ${resolvedUrl}`,
    ].join(" | ")
  );

  return {
    text: null,

    source: null,

    status:
      "failed",

    fetchedAt,

    length: 0,

    resolvedUrl,
  };
}

/*
 * ============================================================
 * Discover News
 * ============================================================
 */

export async function discoverNews(): Promise<
  DiscoveredNews[]
> {
  const candidates: DiscoveredNews[] =
    [];

  const discoveredAt =
    new Date().toISOString();

  console.log(
    "============================================================"
  );

  console.log(
    "Frontier AI News Discovery Starting"
  );

  console.log(
    `RSS feeds: ${NEWS_RSS_FEEDS.length}`
  );

  console.log(
    "============================================================"
  );

  /*
   * ----------------------------------------------------------
   * Process each RSS feed independently
   * ----------------------------------------------------------
   */

  for (
    const feedSource of NEWS_RSS_FEEDS
  ) {
    console.log(
      [
        "",
        "------------------------------------------------------------",
        `Scanning: ${feedSource.name}`,
        `Feed: ${feedSource.url}`,
        "------------------------------------------------------------",
      ].join("\n")
    );

    try {
      /*
       * THIS is the correct rss-parser usage.
       */

      const feed =
        await parser.parseURL(
          feedSource.url
        );

      console.log(
        `${feedSource.name}: ${feed.items.length} RSS items found.`
      );

      for (
        const rawItem of feed.items as FeedItem[]
      ) {
        /*
         * ------------------------------------------------------
         * Basic validation
         * ------------------------------------------------------
         */

        if (
          !rawItem.title ||
          !rawItem.link
        ) {
          continue;
        }

        const title =
          cleanText(
            rawItem.title
          );

        /*
         * ------------------------------------------------------
         * Article URL
         * ------------------------------------------------------
         */

        let articleUrl =
          rawItem.link.trim();

        articleUrl =
          decodeHtmlEntities(
            articleUrl
          ).trim();

        /*
         * Google News URLs are rejected.
         */

        if (
          isGoogleNewsUrl(
            articleUrl
          )
        ) {
          console.warn(
            [
              "[NEWS DISCOVERY]",
              "Skipping Google News wrapper",
              `Source: ${feedSource.name}`,
              `Title: ${title}`,
            ].join(" | ")
          );

          continue;
        }

        /*
         * Validate URL.
         */

        try {
          new URL(
            articleUrl
          );
        } catch {
          console.warn(
            [
              "[NEWS DISCOVERY]",
              "Skipping invalid URL",
              `Source: ${feedSource.name}`,
              `URL: ${articleUrl}`,
            ].join(" | ")
          );

          continue;
        }

        /*
         * ------------------------------------------------------
         * RSS summary
         * ------------------------------------------------------
         */

        const summary =
          getFeedSummary(
            rawItem
          );

        /*
         * ------------------------------------------------------
         * Relevance
         * ------------------------------------------------------
         */

        const relevance =
          calculateRelevance(
            title,
            summary
          );

        /*
         * Low threshold because Gemini performs
         * the final editorial filtering.
         */

        if (
          relevance.score < 15
        ) {
          continue;
        }

        /*
         * ------------------------------------------------------
         * Trusted source boost
         * ------------------------------------------------------
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
         * Fetch actual article
         * ------------------------------------------------------
         */

        console.log(
          [
            "[NEWS DISCOVERY]",
            "Fetching article",
            `Source: ${feedSource.name}`,
            `Title: ${title}`,
            `URL: ${articleUrl}`,
          ].join(" | ")
        );

        const articleContent =
          await fetchArticle(
            articleUrl,
            summary
          );

        /*
         * ------------------------------------------------------
         * Determine final URL
         * ------------------------------------------------------
         */

        const finalArticleUrl =
          articleContent.resolvedUrl &&
          !isGoogleNewsUrl(
            articleContent.resolvedUrl
          )
            ? articleContent.resolvedUrl
            : articleUrl;

        /*
         * Never store a Google URL.
         */

        if (
          isGoogleNewsUrl(
            finalArticleUrl
          )
        ) {
          console.warn(
            [
              "[NEWS DISCOVERY]",
              "Skipping because final URL is Google News",
              `Title: ${title}`,
            ].join(" | ")
          );

          continue;
        }

        /*
         * ------------------------------------------------------
         * Published date
         * ------------------------------------------------------
         */

        const publishedAt =
          getPublishedAt(
            rawItem
          );

        /*
         * ------------------------------------------------------
         * Source name
         * ------------------------------------------------------
         */

        const sourceName =
          feedSource.name ||
          getDomain(
            finalArticleUrl
          ) ||
          "Unknown";

        /*
         * ------------------------------------------------------
         * Candidate
         * ------------------------------------------------------
         */

        const candidate: DiscoveredNews =
          {
            title,

            source_url:
              articleUrl,

            article_url:
              finalArticleUrl,

            source_name:
              sourceName,

            summary,

            published_at:
              publishedAt,

            discovered_at:
              discoveredAt,

            article_text:
              articleContent.text,

            article_text_source:
              articleContent.source,

            article_text_fetched_at:
              articleContent.fetchedAt,

            article_text_length:
              articleContent.length,

            article_fetch_status:
              articleContent.status,

            relevance_score:
              finalScore,

            matched_keywords:
              relevance.matchedKeywords,
          };

        candidates.push(
          candidate
        );

        /*
         * ------------------------------------------------------
         * Debug logging
         * ------------------------------------------------------
         */

        console.log(
          [
            "[NEWS CANDIDATE]",
            `Title: ${candidate.title}`,
            `Source: ${candidate.source_name}`,
            `URL: ${candidate.article_url}`,
            `Article text: ${candidate.article_text_length} chars`,
            `Status: ${candidate.article_fetch_status}`,
            `Method: ${candidate.article_text_source ?? "none"}`,
            `Relevance: ${candidate.relevance_score}`,
          ].join(" | ")
        );
      }
    } catch (error) {
      console.error(
        [
          "[NEWS DISCOVERY]",
          `Failed to process feed: ${feedSource.name}`,
          error instanceof Error
            ? error.message
            : String(error),
        ].join(" | ")
      );

      /*
       * Continue to next publisher.
       */
    }
  }

  /*
   * ==========================================================
   * Deduplicate
   * ==========================================================
   *
   * If the same article appears in multiple feeds,
   * prefer the version containing more article text.
   * ==========================================================
   */

  const byUrl =
    new Map<
      string,
      DiscoveredNews
    >();

  for (
    const candidate of candidates
  ) {
    const normalizedUrl =
      candidate.article_url
        .split("#")[0]
        .replace(
          /\/$/,
          ""
        );

    const existing =
      byUrl.get(
        normalizedUrl
      );

    if (!existing) {
      byUrl.set(
        normalizedUrl,
        candidate
      );

      continue;
    }

    if (
      candidate.article_text_length >
      existing.article_text_length
    ) {
      byUrl.set(
        normalizedUrl,
        candidate
      );
    }
  }

  const unique =
    Array.from(
      byUrl.values()
    );

  /*
   * ==========================================================
   * Sort
   * ==========================================================
   */

  unique.sort(
    (a, b) => {
      if (
        b.relevance_score !==
        a.relevance_score
      ) {
        return (
          b.relevance_score -
          a.relevance_score
        );
      }

      const aDate =
        a.published_at
          ? new Date(
              a.published_at
            ).getTime()
          : 0;

      const bDate =
        b.published_at
          ? new Date(
              b.published_at
            ).getTime()
          : 0;

      return (
        bDate - aDate
      );
    }
  );

  /*
   * ==========================================================
   * Final statistics
   * ==========================================================
   */

  const successfulFetches =
    unique.filter(
      (item) =>
        item.article_fetch_status ===
        "success"
    ).length;

  const partialFetches =
    unique.filter(
      (item) =>
        item.article_fetch_status ===
        "partial"
    ).length;

  const failedFetches =
    unique.filter(
      (item) =>
        item.article_fetch_status ===
        "failed"
    ).length;

  console.log(
    "============================================================"
  );

  console.log(
    "Frontier AI News Discovery Complete"
  );

  console.log(
    `Raw candidates: ${candidates.length}`
  );

  console.log(
    `Unique candidates: ${unique.length}`
  );

  console.log(
    `Successful article fetches: ${successfulFetches}`
  );

  console.log(
    `Partial article fetches: ${partialFetches}`
  );

  console.log(
    `Failed article fetches: ${failedFetches}`
  );

  console.log(
    "============================================================"
  );

  return unique;
}