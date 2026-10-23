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
      "User-Agent": "DevToolsAPI-EducationalResearch/1.0"
    },
    signal: AbortSignal.timeout(12000)
  });

  if (!response.ok) {
    throw new Error("Wikipedia search service returned an error.");
  }

  return response.json();
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

  const searchData = await wikipediaRequest({
    action: "query",
    list: "search",
    srsearch: normalizedQuery,
    srlimit: safeLimit,
    srnamespace: 0,
    format: "json"
  });

  const matches = searchData?.query?.search || [];

  if (matches.length === 0) {
    return {
      query: normalizedQuery,
      results: []
    };
  }

  const pageIds = matches
    .map((item) => item.pageid)
    .join("|");

  const detailData = await wikipediaRequest({
    action: "query",
    prop: "extracts",
    pageids: pageIds,
    exintro: 1,
    explaintext: 1,
    exchars: 2200,
    format: "json"
  });

  const pages = detailData?.query?.pages || {};

  const results = matches
    .map((match) => {
      const page = pages[String(match.pageid)] || {};

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
    .filter((item) => item.extract);

  return {
    query: normalizedQuery,
    results
  };
}

module.exports = {
  searchWebResearch
};
