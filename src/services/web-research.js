// DevTools API — Web Research Service v1.2
// Retrieves more source text for research-based MCQ generation.
// No paid AI API key required.

"use strict";

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function wikipediaRequest(params) {
  const url = new URL(WIKIPEDIA_API);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "DevToolsAPI-EducationalResearch/1.2"
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(
      `Wikipedia returned HTTP ${response.status}.`
    );
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(
      data.error.info || "Wikipedia research request failed."
    );
  }

  return data;
}

async function searchWebResearch(query, limit = 5) {
  const normalizedQuery = cleanText(query);

  if (!normalizedQuery) {
    throw new Error("Enter a topic to search.");
  }

  const safeLimit = Math.min(
    Math.max(Number(limit) || 5, 1),
    5
  );

  // Search for articles relevant to the requested topic.
  const searchData = await wikipediaRequest({
    action: "query",
    list: "search",
    srsearch: normalizedQuery,
    srlimit: safeLimit,
    srnamespace: 0,
    format: "json",
    formatversion: 2
  });

  const matches = searchData?.query?.search || [];

  if (matches.length === 0) {
    return {
      query: normalizedQuery,
      results: []
    };
  }

  const pageIds = matches
    .map(item => item.pageid)
    .filter(Number.isInteger)
    .join("|");

  if (!pageIds) {
    return {
      query: normalizedQuery,
      results: []
    };
  }

  // Retrieve article text instead of limiting results
  // to the introduction alone.
  const detailData = await wikipediaRequest({
    action: "query",
    prop: "extracts",
    pageids: pageIds,
    explaintext: 1,
    exsentences: 10,
    format: "json",
    formatversion: 2
  });

  const pages = detailData?.query?.pages || [];

  const pageMap = new Map(
    pages.map(page => [page.pageid, page])
  );

  const results = matches
    .map(match => {
      const page = pageMap.get(match.pageid) || {};

      return {
        title: cleanText(match.title),
        snippet: cleanText(match.snippet),
        extract: cleanText(page.extract),
        source: "Wikipedia",
        url:
          "https://en.wikipedia.org/?curid=" +
          encodeURIComponent(match.pageid)
      };
    })
    .filter(item => item.extract.length >= 100);

  return {
    query: normalizedQuery,
    results
  };
}

module.exports = {
  searchWebResearch
};
