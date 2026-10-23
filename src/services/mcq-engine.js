// DevTools API — Rule-Based MCQ Engine v1.1
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
  "on", "or", "if", "it", "process", "processes"
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
function getKeywords(text) {
  const words = text.match(/\b[A-Za-z][A-Za-z'-]*\b/g) || [];
  return [...new Set(
    words.filter(word =>
      word.length >= 4 &&
      !STOP_WORDS.has(word.toLowerCase())
    )
  )];
}
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function createOptions(answer, sentenceKeywords, allKeywords) {
  const answerLower = answer.toLowerCase();
  const sentenceWords = new Set(
    sentenceKeywords.map(word => word.toLowerCase())
  );
  // Prefer words appearing elsewhere in the supplied notes.
  const otherSentenceWords = allKeywords.filter(word =>
    word.toLowerCase() !== answerLower &&
    !sentenceWords.has(word.toLowerCase())
  );
  const sameSentenceWords = sentenceKeywords.filter(word =>
    word.toLowerCase() !== answerLower
  );
  const candidates = [
    ...new Set([...otherSentenceWords, ...sameSentenceWords])
  ];
  const options = [answer];
  for (const word of candidates) {
    if (options.length >= 4) break;
    if (!options.some(option =>
      option.toLowerCase() === word.toLowerCase()
    )) {
      options.push(word);
    }
  }
  // Use generic alternatives only when the notes lack enough words.
  const fallbacks = [
    "Not stated in the notes",
    "None of the above",
    "All of the above"
  ];
  for (const fallback of fallbacks) {
    if (options.length >= 4) break;
    options.push(fallback);
  }
  // Randomize the answer position.
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options.map((text, index) => ({
    id: String.fromCharCode(65 + index),
    text,
    isCorrect: text.toLowerCase() === answerLower
  }));
}
function generateMCQs({
  topic = "General Studies",
  notes = "",
  count = 10,
  difficulty = "medium"
} = {}) {
  if (typeof notes !== "string" || !notes.trim()) {
    throw new Error("Study notes are required.");
  }
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    throw new Error("Count must be between 1 and 50.");
  }
  if (!["easy", "medium", "hard"].includes(difficulty)) {
    throw new Error("Difficulty must be easy, medium, or hard.");
  }
  const sentences = splitSentences(notes);
  const allKeywords = getKeywords(notes);
  const questions = [];
  const seen = new Set();
  for (const sentence of sentences) {
    if (questions.length >= count) break;
    const keywords = getKeywords(sentence);
    if (keywords.length < 2) continue;
    const answer = keywords[keywords.length - 1];
    const pattern = new RegExp(
      "\\b" + escapeRegExp(answer) + "\\b",
      "i"
    );
    const questionText = sentence.replace(pattern, "________");
    const questionKey = questionText.toLowerCase();
    if (questionText === sentence || seen.has(questionKey)) {
      continue;
    }
    const options = createOptions(
      answer,
      keywords,
      allKeywords
    );
    // Every question must have exactly one correct option.
    const correctCount = options.filter(
      option => option.isCorrect
    ).length;
    if (correctCount !== 1) continue;
    seen.add(questionKey);
    questions.push({
      id: questions.length + 1,
      topic: cleanText(topic) || "General Studies",
      difficulty,
      question: `Complete the statement: ${questionText}`,
      options,
      answer,
      explanation:
        `The supplied study note states: "${sentence}"`,
      source: "provided_notes"
    });
  }
  return {
    success: true,
    engine: "devtools-rule-based-mcq-v1.1",
    topic: cleanText(topic) || "General Studies",
    difficulty,
    requestedCount: count,
    generatedCount: questions.length,
    questions,
    message: questions.length
      ? "Questions generated from the supplied notes. Review before using in an exam."
      : "No suitable questions could be generated. Provide more detailed notes."
  };
}
module.exports = {
  generateMCQs
};
