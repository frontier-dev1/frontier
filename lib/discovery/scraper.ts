import Parser from "rss-parser";

type FeedItem = {
  title?: string;
  link?: string;
  guid?: string;
  pubDate?: string;
  isoDate?: string;
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
  article_fetch_status: "pending" | "success" | "partial" | "failed";
};

const parser = new Parser<FeedItem>();

const USER_AGENT =
  "Mozilla/5.0 (compatible; Frontier Incident Research Bot/1.0; +https://frontier-eight.vercel.app/)";

const MAX_ARTICLE_LENGTH = 50000;
const MIN_ARTICLE_LENGTH = 300;

const GOOGLE_NEWS_BOILERPLATE =
  "Comprehensive up-to-date news coverage, aggregated from sources all over the world by Google News.";

const GOOGLE_INFRASTRUCTURE_HOSTS = [
  "lh3.googleusercontent.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
  "lh6.googleusercontent.com",
  "googleusercontent.com",
  "gstatic.com",
];

const RSS_FEEDS = [
  "https://news.google.com/rss/search?q=%22rogue+AI%22+when:7d&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=%22AI+agent%22+hack+when:7d&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=%22AI+agent%22+%22unauthorized%22+when:7d&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=%22AI+agent%22+%22unexpected+behavior%22+when:7d&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=%22AI+model%22+%22went+rogue%22+when:7d&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=%22AI+agent%22+%22safety+incident%22+when:7d&hl=en-US&gl=US&ceid=US:en",
];

const KEYWORDS: Record<string, number> = {
  "rogue AI": 30,
  "went rogue": 30,
  "AI agent": 15,
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

/* ----------------------------------------------------------
   Helpers & Text Formatting
   ---------------------------------------------------------- */

function cleanText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncateText(text: string, maxCharacters: number): string {
  if (text.length <= maxCharacters) {
    return text;
  }
  return text.slice(0, maxCharacters) + "\n\n[ARTICLE TEXT TRUNCATED]";
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

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isGoogleNewsUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "news.google.com" || hostname.endsWith(".news.google.com");
  } catch {
    return false;
  }
}

function isGoogleInfrastructureUrl(url: string): boolean {
  const hostname = getDomain(url);
  if (!hostname) return false;
  return GOOGLE_INFRASTRUCTURE_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`)
  );
}

function isValidPublisherUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (isGoogleNewsUrl(url)) return false;
    if (isGoogleInfrastructureUrl(url)) return false;
    return true;
  } catch {
    return false;
  }
}

function isTrustedSource(url: string): boolean {
  const domain = getDomain(url);
  return TRUSTED_SOURCES.some(
    (trusted) => domain === trusted || domain.endsWith(`.${trusted}`)
  );
}

function calculateRelevance(title: string, summary: string) {
  const text = `${title} ${summary}`.toLowerCase();
  let score = 0;
  const matchedKeywords: string[] = [];

  for (const [keyword, weight] of Object.entries(KEYWORDS)) {
    if (text.includes(keyword.toLowerCase())) {
      score += weight;
      matchedKeywords.push(keyword);
    }
  }

  return {
    score: Math.min(score, 100),
    matchedKeywords,
  };
}

function isUsableArticleText(text: string | null): boolean {
  if (!text) return false;
  const cleaned = cleanText(text);
  if (cleaned.length < MIN_ARTICLE_LENGTH) return false;
  if (cleaned.toLowerCase().includes(GOOGLE_NEWS_BOILERPLATE.toLowerCase())) return false;
  return true;
}

async function fetchHtml(url: string, timeoutMs = 10000): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return null;
    }

    const html = await response.text();
    return { html, finalUrl: response.url || url };
  } catch {
    return null;
  }
}

/* ----------------------------------------------------------
   Google News URL Resolution
   ---------------------------------------------------------- */

function extractGoogleNewsArticleId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const articleIndex = segments.findIndex((s) => s === "articles" || s === "read");
    if (articleIndex >= 0 && segments[articleIndex + 1]) {
      return decodeURIComponent(segments[articleIndex + 1]);
    }
    return null;
  } catch {
    return null;
  }
}

function extractGoogleDecodeParams(html: string, articleId: string) {
  const escapedId = articleId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<[^>]*data-n-a-id=["']${escapedId}["'][^>]*data-n-a-sg=["']([^"']+)["'][^>]*data-n-a-ts=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const match = html.match(pattern);
  if (match?.[1] && match?.[2]) {
    return { id: articleId, signature: match[1], timestamp: match[2] };
  }
  return null;
}

async function resolveGoogleNewsUrl(googleNewsUrl: string): Promise<string | null> {
  if (!isGoogleNewsUrl(googleNewsUrl)) {
    return isValidPublisherUrl(googleNewsUrl) ? googleNewsUrl : null;
  }

  const articleId = extractGoogleNewsArticleId(googleNewsUrl);
  if (!articleId) return null;

  const googleArticleUrl = `https://news.google.com/articles/${encodeURIComponent(articleId)}?hl=en-US&gl=US&ceid=US:en`;
  const response = await fetchHtml(googleArticleUrl, 8000);
  if (!response) return null;

  const params = extractGoogleDecodeParams(response.html, articleId);
  if (!params) return null;

  const innerRequest = JSON.stringify([
    "garturlreq",
    [["en-US", "US", ["FINANCE_TOP_INDICES", "WEB_TEST_1_0_0"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1], "en-US", "US", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
    params.id,
    Number(params.timestamp),
    params.signature,
  ]);

  const rpcPayload = JSON.stringify([[["Fbv4je", innerRequest, null, "generic"]]]);

  try {
    const rpcResponse = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": USER_AGENT,
      },
      body: `f.req=${encodeURIComponent(rpcPayload)}`,
      signal: AbortSignal.timeout(8000),
    });

    if (!rpcResponse.ok) return null;
    const text = await rpcResponse.text();
    const urls = text.match(/https?:\/\/[^\s"'\\]+/g) || [];

    for (const candidate of urls) {
      const cleaned = candidate.replace(/[\\"]+$/g, "");
      if (isValidPublisherUrl(cleaned)) {
        return cleaned;
      }
    }
  } catch {
    return null;
  }

  return null;
}

/* ----------------------------------------------------------
   Article Content Extractor
   ---------------------------------------------------------- */

export async function fetchArticleContent(
  publisherUrl: string,
  rssSummary: string | null
): Promise<{
  text: string | null;
  source: "article" | "rss" | "failed";
  status: "success" | "partial" | "failed";
  resolvedUrl: string;
}> {
  if (!isValidPublisherUrl(publisherUrl)) {
    return { text: null, source: "failed", status: "failed", resolvedUrl: publisherUrl };
  }

  const response = await fetchHtml(publisherUrl);
  if (!response) {
    if (rssSummary && rssSummary.length >= 100) {
      return {
        text: truncateText(cleanText(rssSummary), 10000),
        source: "rss",
        status: "partial",
        resolvedUrl: publisherUrl,
      };
    }
    return { text: null, source: "failed", status: "failed", resolvedUrl: publisherUrl };
  }

  const text = cleanText(response.html.replace(/<[^>]+>/g, " "));
  if (isUsableArticleText(text)) {
    return {
      text: truncateText(text, MAX_ARTICLE_LENGTH),
      source: "article",
      status: "success",
      resolvedUrl: response.finalUrl || publisherUrl,
    };
  }

  return { text: null, source: "failed", status: "failed", resolvedUrl: publisherUrl };
}

/* ----------------------------------------------------------
   Main Candidate Discovery Entrypoint
   ---------------------------------------------------------- */

export async function discoverCandidates(): Promise<DiscoveredCandidate[]> {
  const candidates: DiscoveredCandidate[] = [];
  const seenUrls = new Set<string>();

  // Fetch all RSS feeds in parallel to prevent Vercel timeouts
  const feedPromises = RSS_FEEDS.map(async (feedUrl) => {
    try {
      return await parser.parseURL(feedUrl);
    } catch {
      return null;
    }
  });

  const feedResults = await Promise.allSettled(feedPromises);

  for (const result of feedResults) {
    if (result.status !== "fulfilled" || !result.value) continue;
    const feed = result.value;

    for (const rawItem of feed.items) {
      if (!rawItem.title || !rawItem.link) continue;

      const title = rawItem.title.trim();
      const summary = (rawItem.contentSnippet ?? rawItem.content ?? "").trim();
      const googleNewsUrl = rawItem.link.trim();

      // Lower threshold slightly to 15 to ensure valid candidates aren't dropped prematurely
      const relevance = calculateRelevance(title, summary);
      if (relevance.score < 15) continue;

      // Prioritize article publication date over discovery date
      const publishedAt = rawItem.isoDate
        ? new Date(rawItem.isoDate).toISOString()
        : rawItem.pubDate
        ? new Date(rawItem.pubDate).toISOString()
        : null;

      // Resolve Google News redirection URL to actual article URL
      let articleUrl: string | null = null;
      if (isGoogleNewsUrl(googleNewsUrl)) {
        articleUrl = await resolveGoogleNewsUrl(googleNewsUrl);
      } else {
        articleUrl = googleNewsUrl;
      }

      if (!articleUrl || !isValidPublisherUrl(articleUrl) || seenUrls.has(articleUrl)) {
        continue;
      }

      seenUrls.add(articleUrl);

      const trusted = isTrustedSource(articleUrl);
      const finalScore = trusted ? Math.min(relevance.score + 15, 100) : relevance.score;
      const sourceDomain = getDomain(articleUrl);

      candidates.push({
        id: crypto.randomUUID(),
        title,
        source_url: googleNewsUrl,
        article_url: articleUrl,
        source_name: rawItem.source?.name || sourceDomain || "News Source",
        summary: summary || null,
        published_at: publishedAt,
        discovered_at: new Date().toISOString(),
        status: "pending",
        relevance_score: finalScore,
        matched_keywords: relevance.matchedKeywords,
        notes: null,
        article_text: null,
        article_text_source: null,
        article_text_fetched_at: null,
        article_text_length: 0,
        article_fetch_status: "pending",
      });
    }
  }

  return candidates;
}