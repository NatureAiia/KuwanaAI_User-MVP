/**
 * Thin client for a self-hosted Firecrawl instance (see .env.example) — the
 * fetch/crawl engine behind /admin/scraper. Talks to Firecrawl's v2 API
 * (POST /v2/scrape, POST /v2/search) as documented at
 * https://docs.firecrawl.dev at the time this was written.
 */

export class FirecrawlNotConfiguredError extends Error {
  constructor() {
    super("FIRECRAWL_API_URL is not set — see .env.example for how to self-host Firecrawl.");
  }
}

function headers(): Record<string, string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const baseUrl = process.env.FIRECRAWL_API_URL;
  if (!baseUrl) throw new FirecrawlNotConfiguredError();

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.success === false) {
    const detail = json?.error ? ` — ${json.error}` : "";
    throw new Error(`Firecrawl ${path} failed: HTTP ${res.status}${detail}`);
  }
  return json as T;
}

export type ScrapedPage = { markdown: string; url: string; title: string | null };

export async function scrapeUrl(url: string): Promise<ScrapedPage> {
  const result = await post<{
    data: { markdown: string; metadata: { url?: string; sourceURL?: string; title?: string } };
  }>("/v2/scrape", { url, formats: ["markdown"], onlyMainContent: true });

  const { data } = result;
  return {
    markdown: data.markdown,
    url: data.metadata.url ?? data.metadata.sourceURL ?? url,
    title: data.metadata.title ?? null,
  };
}

export type SearchResult = { url: string; title: string; description: string };

export async function searchWeb(query: string, opts: { limit?: number } = {}): Promise<SearchResult[]> {
  const result = await post<{ data: { web?: SearchResult[] } }>("/v2/search", {
    query,
    limit: opts.limit ?? 5,
  });
  return result.data.web ?? [];
}
