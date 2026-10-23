const express = require("express");
const { searchWebResearch } = require("../services/web-research");
const { generateMCQs } = require("../services/mcq-engine");

const router = express.Router();

router.get("/search", async (req, res) => {
  try {
    const query = typeof req.query.q === "string"
      ? req.query.q.trim()
      : "";

    if (!query || query.length > 160) {
      return res.status(400).json({
        success: false,
        error: "Provide a valid search topic."
      });
    }

    const result = await searchWebResearch(query, 5);

    res.json({
      success: true,
      module: "devtools-web-research-v1.0",
      ...result
    });
  } catch (error) {
    console.error("Research search error:", error.message);

    res.status(502).json({
      success: false,
      error: "Online research is temporarily unavailable."
    });
  }
});

router.post("/questions", async (req, res) => {
  try {
    const {
      topic = "",
      count = 10,
      difficulty = "medium"
    } = req.body || {};

    if (
      typeof topic !== "string" ||
      !topic.trim() ||
      topic.trim().length > 160
    ) {
      return res.status(400).json({
        success: false,
        error: "Provide a valid topic."
      });
    }

    if (!Number.isInteger(count) || count < 1 || count > 20) {
      return res.status(400).json({
        success: false,
        error: "Count must be between 1 and 20."
      });
    }

    if (!["easy", "medium", "hard"].includes(difficulty)) {
      return res.status(400).json({
        success: false,
        error: "Difficulty must be easy, medium, or hard."
      });
    }

    const research = await searchWebResearch(topic.trim(), 5);

    if (!research.results.length) {
      return res.status(404).json({
        success: false,
        error: "No matching articles were found.",
        sources: []
      });
    }

    const notes = research.results
      .map(item => `${item.title}. ${item.extract}`)
      .join("\n\n");

    const generated = generateMCQs({
      topic: topic.trim(),
      notes,
      count,
      difficulty
    });

    res.json({
      success: true,
      module: "devtools-web-research-v1.0",
      sources: research.results.map(({ title, url, source }) => ({
        title,
        url,
        source
      })),
      ...generated
    });
  } catch (error) {
    console.error("Research question error:", error.message);

    res.status(502).json({
      success: false,
      error: "Unable to retrieve information or generate questions."
    });
  }
});

module.exports = router;
