const express = require("express");

const router = express.Router();

// Generate multiple-choice questions
router.post("/generate", async (req, res) => {
try {
const { topic, notes, count = 10, difficulty = "medium" } =
req.body || {};

if (
  (!topic || typeof topic !== "string") &&
  (!notes || typeof notes !== "string")
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
return res.status(501).json({
  success: false,
  status: "model_not_connected",
  message:
    "The MCQ endpoint is ready for validation. An AI model must be connected before questions can be generated.",
  request: {
    topic: topic || null,
    notesProvided: Boolean(notes),
    count,
    difficulty
  }
});

} catch (error) {
console.error("MCQ generation error:", error);

return res.status(500).json({
  success: false,
  error: {
    code: "MCQ_GENERATION_FAILED",
    message: "Unable to process the MCQ request."
  }
});

}
});

module.exports = router;
