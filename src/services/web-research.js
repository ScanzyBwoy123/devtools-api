// DevTools API — Web Research Service v1.3
// Searches related topics and retrieves longer source extracts.
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
      "User-Agent": "DevToolsAPI-EducationalResearch/1.3"
    },
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    throw new Error(`Wikipedia returned HTTP ${response.status}.`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(
      data.error.info || "Wikipedia research request failed."
    );
  }

  return data;
}

function buildSearchQueries(topic) {
  const cleanTopic = cleanText(topic);

  const queries = [
    cleanTopic,
    `${cleanTopic} treatment`,
    `${cleanTopic} complications`,
    `${cleanTopic} procedure`
  ];

  return [...new Set(queries)].slice(0, 4);
}

async function searchWebResearch(query, limit = 5) {
  const normalizedQuery = cleanText(query);

  if (!normalizedQuery) {
    throw new Error("Enter a topic to search.");
  }

  const safeLimit = Math.min(
    Math.max(Number(limit) || 5, 1),
    10
  );

  const queries = buildSearchQueries(normalizedQuery);

  // Search several related phrases instead of relying on one exact query.
  const searchResponses = await Promise.allSettled(
    queries.map(searchQuery =>
      wikipediaRequest({
        action: "query",
        list: "search",
        srsearch: searchQuery,
        srlimit: safeLimit,
        srnamespace: 0,
        format: "json",
        formatversion: 2
      })
    )
  );

  const matches = [];
  const seenPageIds = new Set();

  for (const response of searchResponses) {
    if (response.status !== "fulfilled") continue;

    const items = response.value?.query?.search || [];

    for (const item of items) {
      if (!Number.isInteger(item.pageid)) continue;
      if (seenPageIds.has(item.pageid)) continue;

      seenPageIds.add(item.pageid);
      matches.push(item);

      if (matches.length >= safeLimit) break;
    }

    if (matches.length >= safeLimit) break;
  }

  if (matches.length === 0) {
    return {
      query: normalizedQuery,
      results: []
    };
  }

  const pageIds = matches
    .map(item => item.pageid)
    .join("|");

  // Retrieve longer extracts to give the MCQ engine more facts to analyse.
  const detailData = await wikipediaRequest({
    action: "query",
    prop: "extracts",
    pageids: pageIds,
    explaintext: 1,
    exchars: 0,
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
