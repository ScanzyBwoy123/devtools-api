const https = require("https");

const USER_AGENT = "DevToolsAPI/1.0 (educational research service)";

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json",
          },
        },
        (response) => {
          let body = "";

          response.setEncoding("utf8");

          response.on("data", (chunk) => {
            body += chunk;
          });

          response.on("end", () => {
            if (
              response.statusCode < 200 ||
              response.statusCode >= 300
            ) {
              return reject(
                new Error(`Research provider returned HTTP ${response.statusCode}`)
              );
            }

            try {
              resolve(JSON.parse(body));
            } catch {
              reject(new Error("Research provider returned invalid JSON"));
            }
          });
        }
      )
      .on("error", reject);
  });
}

function makeURL(parameters) {
  const url = new URL("https://en.wikipedia.org/w/api.php");

  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

async function searchArticles(query, limit = 8) {
  const cleanedQuery = String(query || "").trim();

  if (!cleanedQuery) {
    throw new Error("A research topic is required.");
  }

  const url = makeURL({
    action: "query",
    list: "search",
    srsearch: cleanedQuery,
    srlimit: limit,
    srnamespace: 0,
    format: "json",
    formatversion: 2,
  });

  const data = await getJSON(url);

  if (!data.query || !Array.isArray(data.query.search)) {
    throw new Error("Research provider returned an unexpected search response.");
  }

  return data.query.search.map((article) => ({
    title: article.title,
    pageId: article.pageid,
    snippet: String(article.snippet || "").replace(/<[^>]*>/g, ""),
    url: `https://en.wikipedia.org/?curid=${article.pageid}`,
  }));
}

async function getArticleExtracts(articles) {
  if (!articles.length) {
    return [];
  }

  const url = makeURL({
    action: "query",
    pageids: articles.map((article) => article.pageId).join("|"),
    prop: "extracts",
    explaintext: 1,
    exchars: 1200,
    format: "json",
    formatversion: 2,
  });

  const data = await getJSON(url);
  const pages = data.query && data.query.pages;

  if (!Array.isArray(pages)) {
    throw new Error("Research provider returned no article details.");
  }

  const pageMap = new Map(
    pages.map((page) => [page.pageid, page])
  );

  return articles
    .map((article) => {
      const page = pageMap.get(article.pageId);

      return {
        ...article,
        extract: page && page.extract ? page.extract : article.snippet,
      };
    })
    .filter((article) => article.extract);
}

async function searchResearch(query, limit = 8) {
  const articles = await searchArticles(query, limit);

  if (articles.length === 0) {
    return [];
  }

  return getArticleExtracts(articles);
}
async function searchWebResearch(query, limit = 5) {
  const results = await searchResearch(query, limit);

  return {
    query,
    results,
  };
}

module.exports = {
  searchWebResearch,
  searchResearch,
  searchArticles,
  getArticleExtracts,
};
