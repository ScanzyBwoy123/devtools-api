const express = require("express");
const { searchWebResearch } = require("../services/web-research");
const { generateMCQs } = require("../services/mcq-engine");
const router = express.Router();
// Search online research sources.
router.get("/search", async (req, res) => {
  try {
    const query =
      typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!query || query.length > 160) {
      return res.status(400).json({
        success: false,
        error: "Provide a valid search topic."
      });
    }
    const result = await searchWebResearch(query, 5);
    return res.json({
      success: true,
      module: "devtools-web-research-v1.1",
      ...result
    });
  } catch (error) {
    console.error("Research search error:", error.message);
    return res.status(502).json({
      success: false,
      error: "Online research is temporarily unavailable."
    });
  }
});
// Research a topic online and generate MCQs from the retrieved material.
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
    const results = Array.isArray(research?.results)
      ? research.results
      : [];
    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No matching research articles were found.",
        sources: [],
        generatedCount: 0,
        questions: []
      });
    }
    const notes = results
      .map(item =>
        [item.title, item.extract]
          .filter(value => typeof value === "string" && value.trim())
          .join(". ")
      )
      .filter(Boolean)
      .join("\n\n");
    if (!notes.trim()) {
      return res.status(422).json({
        success: false,
        error: "Research sources returned no usable text.",
        sources: results.map(({ title, url, source }) => ({
          title,
          url,
          source
        })),
        generatedCount: 0,
        questions: []
      });
    }
    const generated = generateMCQs({
      topic: topic.trim(),
      notes,
      count,
      difficulty,
      researchMode: true
    });
    const generatedCount = Number(generated?.generatedCount) || 0;
    const questions = Array.isArray(generated?.questions)
      ? generated.questions
      : [];
    const sources = results.map(({ title, url, source }) => ({
      title,
      url,
      source
    }));
    return res.status(generatedCount > 0 ? 200 : 422).json({
      success: generatedCount > 0,
      module: "devtools-web-research-v1.1",
      topic: topic.trim(),
      difficulty,
      requestedCount: count,
      generatedCount,
      questions,
      sources,
      message:
        generatedCount > 0
          ? `Generated ${generatedCount} questions from online research.`
          : "Research was completed, but the available text did not produce enough reliable questions. Try another topic."
    });
  } catch (error) {
    console.error("Research question error:", error.message);
    return res.status(502).json({
      success: false,
      error: "Unable to retrieve information or generate questions.",
      generatedCount: 0,
      questions: []
    });
  }
});
module.exports = router;
