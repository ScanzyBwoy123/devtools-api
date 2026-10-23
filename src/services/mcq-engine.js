// DevTools API — MCQ Engine v1.3
// Rule-based question generation.
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
  "on", "or", "if", "it", "process", "processes",
  "according", "notes", "statement", "following"
]);

const SUBJECT_TERMS = {
  nursing: [
    "assessment", "diagnosis", "planning",
    "implementation", "evaluation", "infection",
    "patient", "airway", "sterile technique",
    "vital signs", "documentation"
  ],

  respiratory: [
    "tracheostomy", "suctioning", "bronchoscopy",
    "pneumothorax", "oxygen", "airway",
    "respiration", "ventilation"
  ],

  statistics: [
    "data", "mean", "median", "mode",
    "population", "sample", "frequency",
    "standard deviation", "probability"
  ],

  photosynthesis: [
    "sunlight", "chlorophyll", "glucose",
    "oxygen", "carbon dioxide", "water"
  ]
};

function cleanText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
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

  if (/\bnurs(e|ing|es)\b|\bpatient\b|\bclinical\b/.test(text)) {
    return SUBJECT_TERMS.nursing;
  }

  if (
    /\btracheostomy\b|\bbronchoscopy\b|\bsuctioning\b|\bairway\b/.test(text)
  ) {
    return SUBJECT_TERMS.respiratory;
  }

  return [];
}

function uniqueOptions(answer, candidates) {
  const correct = cleanText(answer);
  const seen = new Set([correct.toLowerCase()]);
  const options = [correct];

  for (const candidate of candidates) {
    const value = cleanText(candidate);

    if (!value || value.length > 140) continue;

    const key = value.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);
    options.push(value);

    if (options.length === 4) break;
  }

  // If the notes do not provide enough alternatives,
  // use explicit placeholders rather than inventing facts.
  const fallbacks = [
    "Not stated in the supplied notes",
    "None of the other options"
  ];

  for (const fallback of fallbacks) {
    if (options.length >= 4) break;

    if (!seen.has(fallback.toLowerCase())) {
      options.push(fallback);
      seen.add(fallback.toLowerCase());
    }
  }

  // Shuffle the answer choices.
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [options[i], options[j]] = [options[j], options[i]];
  }

  return options.map((text, index) => ({
    id: String.fromCharCode(65 + index),
    text,
    isCorrect: text.toLowerCase() === correct.toLowerCase()
  }));
}

function getQuestionStyle(sentence, index, difficulty) {
  const lower = sentence.toLowerCase();

  if (
    /\b(function|purpose|role|responsib|used to|used for)\b/.test(lower)
  ) {
    return {
      type: "function",
      stem: "Which statement best completes this information:"
    };
  }

  if (
    /\b(is defined as|is the definition of|refers to|means)\b/.test(lower)
  ) {
    return {
      type: "definition",
      stem: "Complete this definition:"
    };
  }

  if (difficulty === "hard" && /\b(because|therefore|results in|causes)\b/.test(lower)) {
    return {
      type: "application",
      stem: "Complete this cause-and-effect statement:"
    };
  }

  if (difficulty === "easy") {
    return {
      type: "recall",
      stem: "Complete this statement:"
    };
  }

  const styles = [
    {
      type: "knowledge",
      stem: "According to the supplied notes, complete this statement:"
    },
    {
      type: "recall",
      stem: "Choose the word that completes this statement:"
    },
    {
      type: "understanding",
      stem: "Which option correctly completes this information:"
    }
  ];

  return styles[index % styles.length];
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
    throw new Error("Count must be an integer between 1 and 50.");
  }

  if (!["easy", "medium", "hard"].includes(difficulty)) {
    throw new Error("Difficulty must be easy, medium, or hard.");
  }

  const sentences = splitSentences(notes);
  const allKeywords = getKeywords(notes);
  const subjectTerms = getSubjectTerms(topic, notes);

  const questions = [];
  const seen = new Set();

  for (const sentence of sentences) {
    if (questions.length >= count) break;

    const keywords = getKeywords(sentence);

    if (keywords.length < 2) continue;

    // Prefer meaningful terms near the end of a sentence.
    // Skip very short or generic terms.
    const answer = [...keywords]
      .reverse()
      .find(word => word.length >= 4);

    if (!answer) continue;

    const pattern = new RegExp(
      `\\b${escapeRegExp(answer)}\\b`,
      "i"
    );

    const blankedSentence = sentence.replace(
      pattern,
      "________"
    );

    if (blankedSentence === sentence) continue;

    const questionKey = blankedSentence.toLowerCase();

    if (seen.has(questionKey)) continue;

    seen.add(questionKey);

    const style = getQuestionStyle(
      sentence,
      questions.length,
      difficulty
    );

    // Prefer alternatives related to the subject and notes.
    const candidates = [
      ...subjectTerms,
      ...allKeywords.filter(
        word => word.toLowerCase() !== answer.toLowerCase()
      )
    ];

    const options = uniqueOptions(answer, candidates);

    questions.push({
      id: questions.length + 1,
      topic: cleanText(topic) || "General Studies",
      difficulty,
      questionType: style.type,
      question: `${style.stem} ${blankedSentence}`,
      options,
      answer,
      explanation: `The supplied notes state: "${sentence}"`,
      source: "provided_notes"
    });
  }

  return {
    success: true,
    engine: "devtools-rule-based-mcq-v1.3",
    topic: cleanText(topic) || "General Studies",
    difficulty,
    requestedCount: count,
    generatedCount: questions.length,
    questions,
    message: questions.length
      ? "Questions generated from supplied notes. Review answer accuracy before examination use."
      : "No suitable questions found. Provide more detailed study notes."
  };
}

module.exports = {
  generateMCQs
};
