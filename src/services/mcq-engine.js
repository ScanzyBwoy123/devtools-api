// DevTools API — MCQ Engine v1.6
// General-purpose rule-based question generation.
// No paid AI API required.

const {
  generateOptions
} = require("./distractor-engine");

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "among",
  "because", "been", "before", "being", "between",
  "both", "could", "does", "doing", "during",
  "each", "from", "have", "having", "into",
  "more", "most", "other", "over", "same",
  "should", "some", "such", "than", "that",
  "their", "them", "then", "there", "these",
  "they", "this", "those", "through", "under",
  "very", "were", "what", "when", "where",
  "which", "while", "with", "would", "your",
  "and", "are", "but", "for", "has", "its",
  "not", "the", "was", "who", "will", "you",
  "can", "may", "use", "used", "using", "all",
  "any", "one", "two", "is", "in", "of", "to",
  "a", "an", "as", "at", "by", "on", "or",
  "if", "it", "according", "from", "into"
]);

const WEAK_WORDS = new Set([
  "remove", "removes", "removed", "removing",
  "helps", "help", "examine", "examines",
  "examined", "examination", "created",
  "create", "creates", "provides", "provide",
  "used", "performed", "carried", "out",
  "causes", "cause", "increases", "decreases",
  "contains", "produces", "measures",
  "monitors", "prevents", "requires",
  "absorbs", "surgical", "according"
]);

function cleanText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,;:.]+|[,;:.]+$/g, "");
}

function normalize(text) {
  return cleanText(text)
    .toLowerCase()
    .replace(/[.!?]+$/g, "");
}

function splitSentences(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .split(/(?<=[.!?])\s+|\n+/)
    .map(cleanText)
    .filter(sentence => sentence.length >= 15);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Extract meaningful words, excluding common verbs and filler words.
function getKeywords(text) {
  const words =
    text.match(/\b[A-Za-z][A-Za-z'-]*\b/g) || [];

  return [...new Set(
    words.filter(word => {
      const value = word.toLowerCase();

      return (
        word.length >= 4 &&
        !STOP_WORDS.has(value) &&
        !WEAK_WORDS.has(value)
      );
    })
  )];
}

// Extract structured facts from study notes.
function extractFact(sentence) {
  let match;

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

    [result[i], result[j]] = [
      result[j],
      result[i]
    ];
  }

  return result;
}

// Extract useful medical, scientific, and general study terms.
function getAnswerCandidates(notes) {
  const sentences = splitSentences(notes);
  const candidates = [];

  for (const sentence of sentences) {
    const fact = extractFact(sentence);

    if (fact) {
      candidates.push(fact.entity);

      // Extract short, meaningful parts of definitions and purposes.
      const answerWords = getKeywords(fact.answer);

      candidates.push(...answerWords);
    }

    candidates.push(...getKeywords(sentence));
  }

  return [...new Map(
    candidates
      .map(cleanText)
      .filter(value => value.length >= 4 && value.length <= 100)
      .filter(value => !WEAK_WORDS.has(value.toLowerCase()))
      .map(value => [normalize(value), value])
  ).values()];
}

// Generate and validate four answer options.
function makeOptions(answer, candidates) {
  const correctAnswer = cleanText(answer);

  if (!correctAnswer) return null;

  const validCandidates = candidates.filter(candidate => {
    const value = normalize(candidate);
    const correct = normalize(correctAnswer);

    if (!value || value === correct) return false;

    if (WEAK_WORDS.has(value)) return false;

    // Avoid options that differ only by punctuation or
    // where one answer is simply contained in the other.
    if (
      value.includes(correct) ||
      correct.includes(value)
    ) {
      return false;
    }

    return true;
  });

  const result = generateOptions(
    correctAnswer,
    [...new Set(validCandidates)]
  );

  if (
    !result ||
    !result.success ||
    !Array.isArray(result.options) ||
    result.options.length !== 4
  ) {
    return null;
  }

  const correctCount = result.options.filter(
    option => option.isCorrect
  ).length;

  if (correctCount !== 1) return null;

  return result.options;
}

function makeClozeQuestion(
  sentence,
  keywords,
  allCandidates
) {
  if (!keywords.length) return null;

  // Prefer the last meaningful word in the sentence.
  const answer = [...keywords]
    .reverse()
    .find(word => word.length >= 4);

  if (!answer) return null;

  const pattern = new RegExp(
    `\\b${escapeRegExp(answer)}\\b`,
    "i"
  );

  const blanked = sentence.replace(
    pattern,
    "________"
  );

  if (blanked === sentence) return null;

  const options = makeOptions(
    answer,
    allCandidates
  );

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

function makeDirectQuestion(fact, facts, allCandidates) {
  const otherAnswers = facts
    .filter(item =>
      item.type === fact.type &&
      normalize(item.entity) !== normalize(fact.entity)
    )
    .map(item => item.answer);

  const options = makeOptions(
    fact.answer,
    [...otherAnswers, ...allCandidates]
  );

  if (!options) return null;

  let question;

  if (fact.type === "definition") {
    question =
      `According to the notes, what is ${fact.entity}?`;
  } else if (fact.type === "purpose") {
    question =
      `What is the purpose of ${fact.entity}?`;
  } else {
    question =
      `According to the notes, what does ${fact.entity} do?`;
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
    throw new Error(
      "Difficulty must be easy, medium, or hard."
    );
  }

  const sentences = splitSentences(notes);
  const keywords = getKeywords(notes);
  const candidates = getAnswerCandidates(notes);

  const facts = sentences
    .map(extractFact)
    .filter(Boolean);

  const questions = [];
  const seen = new Set();

  for (const sentence of sentences) {
    if (questions.length >= count) break;

    const fact = extractFact(sentence);

    let question = fact
      ? makeDirectQuestion(fact, facts, candidates)
      : null;

    if (!question) {
      question = makeClozeQuestion(
        sentence,
        getKeywords(sentence),
        candidates.length >= 3 ? candidates : keywords
      );
    }

    if (!question) continue;

    const key = normalize(question.question);

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
    engine: "devtools-rule-based-mcq-v1.6",
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
