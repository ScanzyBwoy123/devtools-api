// DevTools API — MCQ Engine v1.4
// Rule-based generation. No paid AI API required.
const {
  generateOptions
} = require("./distractor-engine");
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
  "on", "or", "if", "it", "from", "according"
]);

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

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

// Extract facts that can support direct examination questions.
function extractFact(sentence) {
  let match;

  // Example:
  // "A tracheostomy is a surgical opening created in the trachea."
  match = sentence.match(
    /^(.+?)\s+is\s+(?:a|an|the)\s+(.+)$/i
  );

  if (match) {
    return {
      entity: cleanText(match[1]),
      answer: cleanText(match[2]),
      type: "definition",
      sentence
    };
  }

  // Example:
  // "Suctioning removes secretions from the airway."
  match = sentence.match(
    /^(.+?)\s+(removes|absorbs|produces|measures|monitors|examines|increases|decreases|prevents|contains|provides|causes|requires)\s+(.+)$/i
  );

  if (match) {
    return {
      entity: cleanText(match[1]),
      answer: cleanText(`${match[2]} ${match[3]}`),
      type: "function",
      sentence
    };
  }

  // Example:
  // "Bronchoscopy is used to examine the airways."
  match = sentence.match(
    /^(.+?)\s+is\s+(?:used|performed|carried out)\s+to\s+(.+)$/i
  );

  if (match) {
    return {
      entity: cleanText(match[1]),
      answer: cleanText(match[2]),
      type: "purpose",
      sentence
    };
  }

  return null;
}

function shuffle(items) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function makeOptions(answer, candidates) {
  const correct = cleanText(answer);
  const options = [correct];
  const seen = new Set([correct.toLowerCase()]);

  for (const candidate of candidates) {
    const value = cleanText(candidate);

    if (!value || value.length > 160) continue;

    const key = value.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);
    options.push(value);

    if (options.length === 4) break;
  }

  // Do not invent facts just to fill all four choices.
  if (options.length < 4) {
    return null;
  }

  return shuffle(options).map((text, index) => ({
    id: String.fromCharCode(65 + index),
    text,
    isCorrect: text.toLowerCase() === correct.toLowerCase()
  }));
}

function makeClozeQuestion(sentence, keywords, allKeywords) {
  const answer = [...keywords]
    .reverse()
    .find(word => word.length >= 4);

  if (!answer) return null;

  const pattern = new RegExp(
    `\\b${escapeRegExp(answer)}\\b`,
    "i"
  );

  const blanked = sentence.replace(pattern, "________");

  if (blanked === sentence) return null;

  // Prefer terms found in the notes instead of unrelated
  // generic choices.
  const candidates = allKeywords.filter(
    word => word.toLowerCase() !== answer.toLowerCase()
  );

  const options = makeOptions(answer, candidates);

  if (!options) return null;

  return {
    questionType: "recall",
    question: `Complete the statement: ${blanked}`,
    options,
    answer,
    explanation: `The supplied notes state: "${sentence}"`,
    source: "provided_notes"
  };
}

function makeDirectQuestion(fact, facts) {
  const otherAnswers = facts
    .filter(item =>
      item.type === fact.type &&
      item.entity.toLowerCase() !== fact.entity.toLowerCase()
    )
    .map(item => item.answer);

  const options = makeOptions(fact.answer, otherAnswers);

  // A direct question is only generated when the notes
  // contain enough comparable facts for meaningful choices.
  if (!options) return null;

  let question;

  if (fact.type === "definition") {
    question = `According to the notes, what is ${fact.entity}?`;
  } else if (fact.type === "purpose") {
    question = `What is the purpose of ${fact.entity}?`;
  } else {
    question = `According to the notes, what does ${fact.entity} do?`;
  }

  return {
    questionType: fact.type,
    question,
    options,
    answer: fact.answer,
    explanation: `The supplied notes state: "${fact.sentence}"`,
    source: "provided_notes"
  };
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
  const facts = sentences
    .map(extractFact)
    .filter(Boolean);

  const questions = [];
  const seen = new Set();

  for (const sentence of sentences) {
    if (questions.length >= count) break;

    const fact = extractFact(sentence);

    let question = fact
      ? makeDirectQuestion(fact, facts)
      : null;

    // If there are not enough comparable facts for a direct
    // question, try a fill-in-the-blank question.
    if (!question) {
      question = makeClozeQuestion(
        sentence,
        getKeywords(sentence),
        keywords
      );
    }

    if (!question) continue;

    const key = question.question.toLowerCase();

    if (seen.has(key)) continue;
    seen.add(key);

    questions.push({
      id: questions.length + 1,
      topic: cleanText(topic) || "General Studies",
      difficulty,
      ...question
    });
  }

  return {
    success: true,
    engine: "devtools-rule-based-mcq-v1.4",
    topic: cleanText(topic) || "General Studies",
    difficulty,
    requestedCount: count,
    generatedCount: questions.length,
    questions,
    message: questions.length
      ? "Questions generated from the supplied notes. Review all questions and answers before examination use."
      : "Not enough suitable information was found. Provide more detailed study notes."
  };
}

module.exports = {
  generateMCQs
};
