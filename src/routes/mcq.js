const express = require("express");
const { generateMCQs } = require("../services/mcq-engine");
const router = express.Router();
// Generate multiple-choice questions
router.post("/generate", async (req, res) => {
  try {
    const {
      topic = "General Studies",
      notes = "",
      count = 10,
      difficulty = "medium"
    } = req.body || {};
    if (
      typeof topic !== "string" ||
      typeof notes !== "string" ||
      (!topic.trim() && !notes.trim())
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_CONTENT",
          message: "Provide a topic or study notes."
        }
      });
    }
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_COUNT",
          message: "Count must be an integer between 1 and 50."
        }
      });
    }
    const allowedDifficulties = ["easy", "medium", "hard"];
    if (!allowedDifficulties.includes(difficulty)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DIFFICULTY",
          message: "Difficulty must be easy, medium, or hard."
        }
      });
    }
    if (!notes.trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: "NOTES_REQUIRED",
          message:
            "This first rule-based engine requires study notes. Topic-only generation will be added later."
        }
      });
    }
    const result = generateMCQs({
      topic,
      notes,
      count,
      difficulty
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("MCQ generation error:", error.message);
    return res.status(500).json({
      success: false,
      error: {
        code: "MCQ_GENERATION_FAILED",
        message: "Unable to generate questions."
      }
    });
  }
});
module.exports = router;
