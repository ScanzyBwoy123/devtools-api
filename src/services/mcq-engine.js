// DevTools API — MCQ Engine v4.0
// Rule-based MCQ generation using supplied notes only.
// No paid AI API required.

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
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
    .split(/\n+|(?<=[.!?])\s+/)
    .map(cleanText)
    .filter(line =>
      line.length >= 20 &&
      line.length <= 500 &&
      /[a-z]/i.test(line) &&
      !/^(chapter|contents|references|bibliography|page \d+)/i.test(line)
    );
}

function isUsable(value) {
  const text = cleanText(value);

  if (text.length < 5 || text.length > 260) {
    return false;
  }

  if (
    /^(and|or|but|the|a|an|of|to|in|for|because|however)\b/i.test(text)
  ) {
    return false;
  }

  if (
    /^(chapter|contents|references|table of contents)\b/i.test(text)
  ) {
    return false;
  }

  return true;
}

// Classify facts using explicit clues in the supplied notes.
function classifyFact(label, content) {
  const text = `${label} ${content}`.toLowerCase();

  if (
    /\b(causes?|etiology|risk factors?|predisposing factors?)\b/.test(text)
  ) {
    return "causes";
  }

  if (
    /\b(signs?|symptoms?|manifestations?|clinical features?)\b/.test(text)
  ) {
    return "symptoms";
  }

  if (
    /\b(nursing interventions?|nursing management|nursing care|preventive measures?)\b/.test(text)
  ) {
    return "interventions";
  }

  if (
    /\b(complications?|adverse effects?|consequences?)\b/.test(text)
  ) {
    return "complications";
  }

  if (
    /\b(definition|defined as|refers to|meaning)\b/.test(text)
  ) {
    return "definitions";
  }

  if (
    /\b(functions?|purposes?|roles?|responsibilities)\b/.test(text)
  ) {
    return "functions";
  }

  return "general";
}

// Extract facts from explicit heading: explanation structures.
function extractHeadingFacts(notes) {
  const facts = [];

  for (const rawLine of String(notes || "").split(/\r?\n/)) {
    const line = cleanText(rawLine);
    const match = line.match(/^([^:]{2,90}):\s*(.{8,260})$/);

    if (!match) {
      continue;
    }

    const label = cleanText(match[1]);
    const answer = cleanText(match[2]);

    if (!isUsable(label) || !isUsable(answer)) {
      continue;
    }

    // Reject likely document headings and transcription commentary.
    if (
      /^(chapter|unit|contents|references|page \d+)/i.test(label) ||
      /^(here is the continuation|here is the transcription|the following text)/i.test(label)
    ) {
      continue;
    }

    facts.push({
      label,
      answer,
      type: classifyFact(label, answer),
      source: line
    });
  }

  return facts;
}

// Extract a limited set of explicit definition patterns.
function extractDefinitionFacts(sentences) {
  const facts = [];

  for (const sentence of sentences) {
    const match = sentence.match(
      /^(.{2,70}?)\s+(?:is defined as|refers to|is)\s+(?:a|an|the)?\s*(.{8,220})$/i
    );

    if (!match) {
      continue;
    }

    const label = cleanText(match[1]);
    const answer = cleanText(match[2]);

    if (!isUsable(label) || !isUsable(answer)) {
      continue;
    }

    facts.push({
      label,
      answer,
      type: "definitions",
      source: sentence
    });
  }

  return facts;
}

function uniqueFacts(facts) {
  const seen = new Set();
  const result = [];

  for (const fact of facts) {
    const key = `${normalize(fact.label)}|${normalize(fact.answer)}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(fact);
  }

  return result;
}

function makeQuestion(fact, group) {
  const answerKey = normalize(fact.answer);

  // Distractors must come from the same classified category.
  const distractors = [];

  for (const candidate of group) {
    const candidateKey = normalize(candidate.answer);

    if (
      candidateKey === answerKey ||
      candidateKey.includes(answerKey) ||
      answerKey.includes(candidateKey)
    ) {
      continue;
    }

    if (
      distractors.some(
        item => normalize(item) === candidateKey
      )
    ) {
      continue;
    }

    distractors.push(candidate.answer);
  }

  // Do not invent distractors when the notes lack enough alternatives.
  if (distractors.length < 3) {
    return null;
  }

  const selectedDistractors = distractors.slice(0, 3);

  let question;

  switch (fact.type) {
    case "causes":
      question = `According to the supplied notes, which statement describes a cause associated with ${fact.label}?`;
      break;

    case "symptoms":
      question = `According to the supplied notes, which statement describes a manifestation associated with ${fact.label}?`;
      break;

    case "interventions":
      question = `According to the supplied notes, which action is associated with ${fact.label}?`;
      break;

    case "complications":
      question = `According to the supplied notes, which statement describes a complication associated with ${fact.label}?`;
      break;

    case "definitions":
      question = `According to the supplied notes, which statement describes ${fact.label}?`;
      break;

    case "functions":
      question = `According to the supplied notes, which statement describes the function of ${fact.label}?`;
      break;

    default:
      question = `According to the supplied notes, which statement is associated with ${fact.label}?`;
  }

  const options = [
    {
      text: fact.answer,
      isCorrect: true
    },
    ...selectedDistractors.map(text => ({
      text,
      isCorrect: false
    }))
  ];

  // Shuffle without changing which answer is correct.
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  const correctOptions = options.filter(
    option => option.isCorrect === true
  );

  if (
    options.length !== 4 ||
    correctOptions.length !== 1 ||
    new Set(options.map(option => normalize(option.text))).size !== 4
  ) {
    return null;
  }

  return {
    questionType: fact.type,
    question,
    options,
    answer: fact.answer,
    explanation: `The supplied notes state: ${fact.source}`,
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
    ...extractDefinitionFacts(sentences)
  ]);

  // Group facts so options come from the same broad category.
  const groups = new Map();

  for (const fact of facts) {
    if (!groups.has(fact.type)) {
      groups.set(fact.type, []);
    }

    groups.get(fact.type).push(fact);
  }

  const questions = [];
  const seenQuestions = new Set();
  const seenAnswers = new Set();

  // Shuffle facts so the same questions aren't always first.
  const shuffledFacts = [...facts].sort(
    () => Math.random() - 0.5
  );

  for (const fact of shuffledFacts) {
    if (questions.length >= count) {
      break;
    }

    const questionKey = normalize(fact.label);
    const answerKey = normalize(fact.answer);

    if (
      seenQuestions.has(questionKey) ||
      seenAnswers.has(answerKey)
    ) {
      continue;
    }

    const group = (groups.get(fact.type) || []).filter(
      item => item !== fact
    );

    const question = makeQuestion(fact, group);

    if (!question) {
      continue;
    }

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
    engine: "devtools-rule-based-mcq-v4.0",
    topic: cleanTopic,
    difficulty,
    requestedCount: count,
    generatedCount: questions.length,
    questions,
    message: questions.length === count
      ? "Questions generated from supplied notes. Review accuracy before examination use."
      : questions.length > 0
        ? `Generated ${questions.length} of ${count} requested questions. The notes may not contain enough suitable facts for more questions.`
        : "No suitable questions could be generated. The notes need more clearly structured facts with enough alternatives in the same category."
  };
}

module.exports = {
  generateMCQs
};
