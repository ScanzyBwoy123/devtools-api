// DevTools API — Rule-Based MCQ Engine
// No paid AI API or external API key required.
const STOP_WORDS = new Set([
  "about", "after", "again", "also", "among", "because",
  "been", "before", "being", "between", "both", "could",
  "does", "during", "each", "from", "have", "into",
  "more", "most", "other", "over", "same", "should",
  "some", "such", "than", "that", "their", "them",
  "then", "there", "these", "they", "this", "those",
  "through", "under", "very", "were", "what", "when",
  "where", "which", "while", "with", "would", "your",
  "and", "are", "but", "for", "has", "its", "not",
  "the", "was", "who", "will", "you", "can", "may",
  "use", "used", "using", "all", "any", "one", "two",
  "is", "in", "of", "to", "a", "an", "as", "at", "by",
  "on", "or", "if", "it"
]);
function cleanText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}
function splitSentences(text) {
  return cleanText(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length >= 25);
}
function getKeywords(sentence) {
  const words = sentence.match(/\b[A-Za-z][A-Za-z'-]*\b/g) || [];
  return [...new Set(
    words.filter(word =>
      word.length >= 4 &&
      !STOP_WORDS.has(word.toLowerCase())
    )
  )];
}
function createOptions(answer, keywords) {
  const alternatives = [...new Set(
    keywords.filter(word =>
      word.toLowerCase() !== answer.toLowerCase()
    )
  )].slice(0, 3);
  const options = [answer, ...alternatives];
  // Add generic distractors when the notes contain
  // too few alternative keywords.
  const fallbacks = [
    "None of the above",
    "All of the above",
    "Not mentioned in the notes"
  ];
  for (const fallback of fallbacks) {
    if (options.length >= 4) break;
    options.push(fallback);
  }
  // Shuffle options.
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options.map((text, index) => ({
    id: String.fromCharCode(65 + index),
    text,
    isCorrect: text === answer
  }));
}
function generateMCQs({
  topic = "General Studies",
  notes = "",
  count = 10,
  difficulty = "medium"
} = {}) {
  if (typeof notes !== "string" || !notes.trim()) {
    throw new Error(
      "Study notes are required for rule-based question generation."
    );
  }
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    throw new Error("Count must be an integer between 1 and 50.");
  }
  if (!["easy", "medium", "hard"].includes(difficulty)) {
    throw new Error("Difficulty must be easy, medium, or hard.");
  }
  const sentences = splitSentences(notes);
  const questions = [];
  const seen = new Set();
  for (const sentence of sentences) {
    if (questions.length >= count) break;
    const keywords = getKeywords(sentence);
    if (keywords.length < 2) continue;
    // Select a meaningful keyword, avoiding the first word
    // where possible.
    const answer = keywords[keywords.length - 1];
    const pattern = new RegExp(
      `\\b${answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i"
    );
    const questionText = sentence.replace(pattern, "________");
    if (questionText === sentence || seen.has(questionText)) {
      continue;
    }
    seen.add(questionText);
    questions.push({
      id: questions.length + 1,
      topic: cleanText(topic) || "General Studies",
      difficulty,
      question: `Complete the statement: ${questionText}`,
      options: createOptions(answer, keywords),
      answer,
      explanation:
        `The supplied study note states: "${sentence}"`,
      source: "provided_notes"
    });
  }
  return {
    success: true,
    engine: "devtools-rule-based-mcq-v1",
    topic: cleanText(topic) || "General Studies",
    difficulty,
    requestedCount: count,
    generatedCount: questions.length,
    questions,
    message: questions.length
      ? "Questions generated from the supplied notes."
      : "No suitable questions could be generated. Provide more detailed study notes."
  };
}
module.exports = {
  generateMCQs
};
