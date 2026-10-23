// DevTools API — Improved Rule-Based MCQ Engine
// Free: no external AI API required.

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

const SUBJECT_TERMS = {
  photosynthesis: [
    "sunlight", "chlorophyll", "glucose",
    "oxygen", "carbon dioxide", "water"
  ],
  nursing: [
    "assessment", "diagnosis", "planning",
    "implementation", "evaluation", "infection"
  ],
  respiratory: [
    "tracheostomy", "suctioning", "bronchoscopy",
    "pneumothorax", "oxygen", "airway"
  ],
  statistics: [
    "data", "mean", "median", "mode",
    "population", "sample", "frequency"
  ]
};

function cleanText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function splitSentences(text) {
  return cleanText(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length >= 20);
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

function getSubjectTerms(topic, notes) {
  const text = `${topic} ${notes}`.toLowerCase();

  for (const [subject, terms] of Object.entries(SUBJECT_TERMS)) {
    if (text.includes(subject)) {
      return terms;
    }
  }

  return [];
}

function makeOptions(answer, keywords, subjectTerms) {
  const answerLower = answer.toLowerCase();

  const candidates = [
    ...subjectTerms,
    ...keywords
  ].filter(word =>
    word.toLowerCase() !== answerLower &&
    word.length >= 3
  );

  const uniqueCandidates = [...new Set(candidates)];

  const options = [answer];

  for (const candidate of uniqueCandidates) {
    if (options.length >= 4) break;
    options.push(candidate);
  }

  const fallbacks = [
    "None of the above",
    "Not stated in the notes",
    "All of the above"
  ];

  for (const fallback of fallbacks) {
    if (options.length >= 4) break;
    options.push(fallback);
  }

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
  const keywords = getKeywords(notes);
  const subjectTerms = getSubjectTerms(topic, notes);

  const questions = [];
  const seen = new Set();

  for (const sentence of sentences) {
    if (questions.length >= count) break;

    const sentenceKeywords = getKeywords(sentence);

    if (sentenceKeywords.length < 2) continue;

    const answer = sentenceKeywords[sentenceKeywords.length - 1];

    const pattern = new RegExp(
      `\\b${escapeRegExp(answer)}\\b`,
      "i"
    );

    const missingText = sentence.replace(pattern, "________");

    if (missingText === sentence) continue;

    const questionText =
      `According to the supplied notes, complete this statement: ${missingText}`;

    const key = questionText.toLowerCase();

    if (seen.has(key)) continue;
    seen.add(key);

    questions.push({
      id: questions.length + 1,
      topic: cleanText(topic) || "General Studies",
      difficulty,
      question: questionText,
      options: makeOptions(answer, keywords, subjectTerms),
      answer,
      explanation: `The supplied notes state: "${sentence}"`,
      source: "provided_notes"
    });
  }

  return {
    success: true,
    engine: "devtools-rule-based-mcq-v1.2",
    topic: cleanText(topic) || "General Studies",
    difficulty,
    requestedCount: count,
    generatedCount: questions.length,
    questions,
    message: questions.length
      ? "Questions generated from the supplied notes. Review the questions and answers before using them in an exam."
      : "No suitable questions found. Provide more detailed study notes."
  };
}

module.exports = {
  generateMCQs
};
