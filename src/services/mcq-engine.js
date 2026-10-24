// DevTools API — MCQ Engine v6.0
// Rule-based MCQ generation using supplied notes only.
// No paid AI API or external AI key required.

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s,;:.–—-]+|[\s,;:.–—-]+$/g, "");
}

function normalize(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");
}

function splitSentences(notes) {
  return String(notes || "")
    .replace(/\r/g, "\n")
    .replace(/[•●▪◦]/g, "\n")
    .split(/\n+|(?<=[.!?])\s+/)
    .map(cleanText)
    .filter(text =>
      text.length >= 20 &&
      text.length <= 500 &&
      /[a-z]/i.test(text) &&
      !/^(chapter|contents|references|bibliography|page\s+\d+)/i.test(text)
    );
}

function isBadHeading(value) {
  const text = normalize(value);

  return (
    /^(chapter|unit|contents|references|bibliography|appendix|table of contents)\b/i.test(text) ||
    /^page\s+\d+/i.test(text) ||
    /^(introduction|conclusion|objectives|references|acknowledgements)$/i.test(text) ||
    text.split(/\s+/).length > 12
  );
}

// Reject weak answers without rejecting legitimate short list items.
function isUsableAnswer(value, allowShort = false) {
  const text = cleanText(value);

  if (text.length < (allowShort ? 3 : 12) || text.length > 260) {
    return false;
  }

  if (isBadHeading(text)) {
    return false;
  }

  if (
    /^(it|this|that|these|those|they|he|she|we|you|there|here|which|what|who|where|when|how|because|however|and|or|but)\b/i.test(text)
  ) {
    return false;
  }

  if (
    /\b(the|a|an|of|to|for|with|from|and|or|as|is|are|was|were|that|which|into|by|on|at|if|when|because)$/i.test(text)
  ) {
    return false;
  }

  // Heading-like fragments are not useful standalone answers.
  if (
    /^[A-Z0-9\s()/-]{2,45}$/.test(text) &&
    !/[.!?:]/.test(text) &&
    text.split(/\s+/).length <= 5 &&
    !allowShort
  ) {
    return false;
  }

  return /[a-z]/i.test(text);
}

function isUsableLabel(value) {
  const text = cleanText(value);

  if (text.length < 3 || text.length > 90) {
    return false;
  }

  if (isBadHeading(text)) {
    return false;
  }

  if (
    /^(here is|the following text|answer|answers|question|questions|notes)$/i.test(text)
  ) {
    return false;
  }

  return /[a-z]/i.test(text);
}

function classifyFact(label, content) {
  const text = `${label} ${content}`.toLowerCase();

  if (/\b(causes?|etiology|risk factors?|predisposing factors?)\b/.test(text)) {
    return "causes";
  }

  if (/\b(signs?|symptoms?|manifestations?|clinical features?)\b/.test(text)) {
    return "symptoms";
  }

  if (/\b(nursing interventions?|nursing management|nursing care|preventive measures?|management|treatment|treatments)\b/.test(text)) {
    return "interventions";
  }

  if (/\b(complications?|adverse effects?|consequences?)\b/.test(text)) {
    return "complications";
  }

  if (/\b(definition|defined as|refers to|meaning)\b/.test(text)) {
    return "definitions";
  }

  if (/\b(functions?|purposes?|roles?|responsibilities)\b/.test(text)) {
    return "functions";
  }

  if (/\b(significance|importance|advantages?|disadvantages?)\b/.test(text)) {
    return "importance";
  }

  return "general";
}

function extractHeadingFacts(notes) {
  const facts = [];

  for (const rawLine of String(notes || "").split(/\r?\n/)) {
    const line = cleanText(rawLine);
    const match = line.match(/^([^:]{2,90}):\s*(.{3,260})$/);

    if (!match) continue;

    const label = cleanText(match[1]);

// Keep the complete sentence so answer options have a consistent format.
const answer = cleanText(sentence);

    // A heading followed by a single word is usually not a complete fact.
    if (!isUsableLabel(label)) continue;
    if (!isUsableAnswer(answer, false)) continue;

    facts.push({
      label,
      answer,
      type: classifyFact(label, answer),
      source: line,
      sourceType: "heading"
    });
  }

  return facts;
}
// Extract useful factual statements from ordinary paragraphs.
function extractStatementFacts(sentences) {
  const facts = [];

  const pattern =
    /^(.{2,90}?)\s+(is defined as|refers to|means|is characterized by|is associated with|is caused by|causes?|leads to|results in|occurs when|is used for|includes|consists of|requires|prevents|reduces|increases|produces|has|have|is|are)\b/i;

  for (const sentence of sentences) {
    const text = cleanText(sentence);

    if (text.length < 25 || text.length > 260) {
      continue;
    }

    const match = text.match(pattern);

    if (!match) {
      continue;
    }

    const label = cleanText(match[1]);

    if (!isUsableLabel(label)) {
      continue;
    }

    if (!isUsableAnswer(text, false)) {
      continue;
    }

    facts.push({
      label,
      answer: text,
      type: classifyFact(label, text),
      source: text,
      sourceType: "statement"
    });
  }

  return facts;
}

function extractDefinitionFacts(sentences) {
  const facts = [];

  const patterns = [
    /^(.{2,70}?)\s+(?:is defined as|refers to|means)\s+(.{8,220})$/i,
    /^(.{2,70}?)\s+is\s+(?:a|an|the)\s+(.{8,220})$/i
  ];

  for (const sentence of sentences) {
    for (const pattern of patterns) {
      const match = sentence.match(pattern);

      if (!match) continue;

      const label = cleanText(match[1]);
      const answer = cleanText(match[2]);

      if (!isUsableLabel(label)) continue;
      if (!isUsableAnswer(answer, false)) continue;

      facts.push({
        label,
        answer,
        type: "definitions",
        source: sentence,
        sourceType: "definition"
      });

      break;
    }
  }

  return facts;
}

function extractListFacts(notes) {
  const facts = [];
  const lines = String(notes || "").split(/\r?\n/);

  let currentHeading = "";

  for (const rawLine of lines) {
    const line = cleanText(rawLine);

    if (!line) continue;

    const headingMatch = line.match(/^([^:]{2,90}):$/);

    if (headingMatch && isUsableLabel(headingMatch[1])) {
      currentHeading = cleanText(headingMatch[1]);
      continue;
    }

    const itemMatch = line.match(/^(?:[-*•]|\d+[.)])\s+(.{3,220})$/);

    if (!itemMatch || !currentHeading) continue;

    const answer = cleanText(itemMatch[1]);

    // Short items are permitted here because they may be terms in a list.
    if (!isUsableAnswer(answer, true)) continue;

    facts.push({
      label: currentHeading,
      answer,
      type: classifyFact(currentHeading, answer),
      source: `${currentHeading}: ${answer}`,
      sourceType: "list"
    });
  }

  return facts;
}

function uniqueFacts(facts) {
  const seen = new Set();
  const result = [];

  for (const fact of facts) {
    const key = `${normalize(fact.label)}|${normalize(fact.answer)}`;

    if (seen.has(key)) continue;

    seen.add(key);
    result.push(fact);
  }

  return result;
}

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "among", "and", "are",
  "associated", "because", "before", "being", "between", "body",
  "can", "cause", "causes", "describes", "during", "each", "from",
  "have", "into", "includes", "including", "its", "may", "more",
  "most", "often", "only", "other", "over", "part", "result",
  "results", "should", "some", "such", "that", "the", "their",
  "them", "then", "there", "these", "this", "those", "through",
  "under", "used", "using", "very", "which", "while", "with",
  "within", "what", "when", "where", "your", "from"
]);

function getKeywords(value) {
  return new Set(
    normalize(value)
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter(word =>
        word.length >= 3 &&
        !STOP_WORDS.has(word) &&
        !/^\d+$/.test(word)
      )
  );
}

function similarityScore(first, second) {
  const a = getKeywords(first);
  const b = getKeywords(second);

  if (!a.size || !b.size) return 0;

  let overlap = 0;

  for (const word of a) {
    if (b.has(word)) overlap++;
  }

  // Overlap relative to the smaller keyword set.
  return overlap / Math.min(a.size, b.size);
}

function hasSharedKeywords(first, second) {
  const a = getKeywords(first);
  const b = getKeywords(second);

  for (const word of a) {
    if (b.has(word)) return true;
  }

  return false;
}

function selectDistractors(fact, candidates) {
  const answerKey = normalize(fact.answer);
  const labelKey = normalize(fact.label);
  const ranked = candidates
    .filter(candidate => {
      const candidateKey = normalize(candidate.answer);
      if (!candidateKey || candidateKey === answerKey) {
        return false;
      }
      if (
        candidateKey.includes(answerKey) ||
        answerKey.includes(candidateKey)
      ) {
        return false;
      }
      if (similarityScore(fact.answer, candidate.answer) > 0.9) {
        return false;
      }
      return true;
    })
    .map(candidate => {
      const sameLabel =
        normalize(candidate.label) === labelKey ? 1 : 0;
      const sameType =
        candidate.type === fact.type ? 1 : 0;
      const subjectSimilarity = similarityScore(
        `${fact.label} ${fact.answer}`,
        `${candidate.label} ${candidate.answer}`
      );
      const answerSimilarity = similarityScore(
        fact.answer,
        candidate.answer
      );
      return {
        candidate,
        score:
          sameLabel * 5 +
          sameType * 2 +
          subjectSimilarity * 2 +
          answerSimilarity
      };
    })
    .sort((a, b) => b.score - a.score);
  const selected = [];
  const seenAnswers = new Set([answerKey]);
  for (const item of ranked) {
    const candidate = item.candidate;
    const key = normalize(candidate.answer);
    if (seenAnswers.has(key)) {
      continue;
    }
    selected.push(candidate.answer);
    seenAnswers.add(key);
    if (selected.length === 3) {
      break;
    }
  }
  return selected;
}
function buildQuestionText(fact) {
  const label = cleanText(fact.label).replace(/[.!?]+$/g, "");
  switch (fact.type) {
    case "causes":
      return `Which of the following is a cause or risk factor related to ${label}?`;
    case "symptoms":
      return `Which of the following is a sign or symptom of ${label}?`;
    case "interventions":
      return `Which action is appropriate for the management of ${label}?`;
    case "complications":
      return `Which of the following is a complication of ${label}?`;
    case "definitions":
      return `Which statement correctly describes ${label}?`;
    case "functions":
      return `Which of the following describes a function of ${label}?`;
    case "importance":
      return `Why is ${label} important?`;
    default:
      return `Which statement best describes ${label}?`;
  }
}
function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function makeQuestion(fact, facts) {
  const distractors = selectDistractors(
    fact,
    facts.filter(candidate => candidate !== fact)
  );

  // Generate a question only when three alternatives are available.
  if (distractors.length !== 3) return null;

  const optionTexts = shuffle([
    fact.answer,
    ...distractors
  ]);

  if (new Set(optionTexts.map(normalize)).size !== 4) {
    return null;
  }

  const options = optionTexts.map(text => ({
    text,
    isCorrect: normalize(text) === normalize(fact.answer)
  }));

  if (options.filter(option => option.isCorrect).length !== 1) {
    return null;
  }

  return {
    questionType: fact.type,
    question: buildQuestionText(fact),
    options,
    answer: fact.answer,
    explanation: cleanText(fact.source),
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

  const cleanTopic = cleanText(topic) || "General Studies";

  const sentences = splitSentences(notes);

  const facts = uniqueFacts([
  ...extractHeadingFacts(notes),
  ...extractDefinitionFacts(sentences),
  ...extractListFacts(notes),
  ...extractStatementFacts(sentences)
]);

  const questions = [];
  const seenQuestions = new Set();
  const seenAnswers = new Set();

  for (const fact of shuffle(facts)) {
    if (questions.length >= count) break;

    // Allow different facts under the same heading to produce questions.
const questionKey =
  `${normalize(fact.label)}|${normalize(fact.answer)}`;

const answerKey = normalize(fact.answer);

    if (
      seenQuestions.has(questionKey) ||
      seenAnswers.has(answerKey)
    ) {
      continue;
    }

    const question = makeQuestion(fact, facts);

    if (!question) continue;

    seenQuestions.add(questionKey);
    seenAnswers.add(answerKey);

    questions.push({
      id: questions.length + 1,
      topic: cleanTopic,
      difficulty,
      ...question
    });
  }

  return {
    success: true,
    engine: "devtools-rule-based-mcq-v6.0",
    topic: cleanTopic,
    difficulty,
    requestedCount: count,
    generatedCount: questions.length,
    questions,
    message: questions.length === count
      ? "Questions generated from supplied notes. Review for accuracy before examination use."
      : questions.length > 0
        ? `Generated ${questions.length} of ${count} requested questions. More related facts may be needed.`
        : "No suitable questions could be generated. Provide several related facts or a structured list of study notes."
  };
}

module.exports = {
  generateMCQs
};
