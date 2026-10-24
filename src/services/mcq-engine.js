// DevTools API — MCQ Engine v6.1
// Rule-based MCQ generation from study notes and web research.
// No paid AI API or external AI key required.

"use strict";

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "among", "and", "are",
  "associated", "because", "before", "being", "between", "body",
  "can", "cause", "causes", "describes", "during", "each", "from",
  "have", "into", "includes", "including", "its", "may", "more",
  "most", "often", "only", "other", "over", "part", "result",
  "results", "should", "some", "such", "that", "the", "their",
  "them", "then", "there", "these", "this", "those", "through",
  "under", "used", "using", "very", "which", "while", "with",
  "within", "what", "when", "where", "your", "was", "were",
  "been", "being", "has", "had", "its", "their", "they",
  "he", "she", "it", "his", "her", "them", "who", "whom"
]);

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[*_`]/g, "")
    .replace(/^\s*(?:[-*•●▪◦]|\d+[.)])\s+/, "")
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
    .filter(sentence =>
      sentence.length >= 20 &&
      sentence.length <= 500 &&
      /[a-z]/i.test(sentence) &&
      !/^(chapter|contents|references|bibliography|page\s+\d+)/i.test(sentence)
    );
}

function isBadHeading(value) {
  const text = normalize(value);

  return (
    /^(chapter|unit|contents|references|bibliography|appendix|table of contents)\b/i.test(text) ||
    /^page\s+\d+/i.test(text) ||
    /^(introduction|conclusion|objectives|acknowledgements)$/i.test(text) ||
    text.split(/\s+/).length > 12
  );
}

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
  const words = text.split(/\s+/);

  if (text.length < 3 || text.length > 90 || words.length > 8) {
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

  if (
    /\b(depends|can|could|should|would|may|might|must|will|was|were|are|is|means|causes?|results?|leads|increases|decreases|requires|includes|produces)\b/i.test(text) ||
    /\b(the|a|an|of|to|for|with|from|on|in|by|and|or|because|when|that|which)$/i.test(text)
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

// Extract facts from lines such as:
// Definition: A tracheostomy is an opening made in the trachea.
function extractHeadingFacts(notes) {
  const facts = [];

  for (const rawLine of String(notes || "").split(/\r?\n/)) {
    const line = cleanText(rawLine);
    const match = line.match(/^([^:]{2,90}):\s*(.{12,260})$/);

    if (!match) continue;

    const label = cleanText(match[1]);
    const answer = cleanText(match[2]);

    if (!isUsableLabel(label)) continue;
    if (!isUsableAnswer(answer)) continue;

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

// Extract definitions from complete sentences.
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
      if (!isUsableAnswer(sentence)) continue;
      if (/^(this|these|those|it|they|there)\b/i.test(label)) continue;

      facts.push({
        label,
        answer: sentence,
        type: "definitions",
        source: sentence,
        sourceType: "definition"
      });

      break;
    }
  }

  return facts;
}

// Extract statements with recognisable subject-predicate structures.
function extractStatementFacts(sentences) {
  const facts = [];

  const pattern =
    /^(.{2,90}?)\s+(is defined as|refers to|means|is characterized by|is associated with|is caused by|causes?|leads to|results in|occurs when|is used for|includes|consists of|requires|prevents|reduces|increases|produces|has|have|is|are)\b/i;

  for (const sentence of sentences) {
    if (sentence.length < 25 || sentence.length > 260) continue;

    const match = sentence.match(pattern);

    if (!match) continue;

    const label = cleanText(match[1]);

    if (!isUsableLabel(label)) continue;
    if (!isUsableAnswer(sentence)) continue;

    facts.push({
      label,
      answer: sentence,
      type: classifyFact(label, sentence),
      source: sentence,
      sourceType: "statement"
    });
  }

  return facts;
}

// Extract lists under headings, for example:
// Signs and symptoms:
// - Fever
// - Headache
function extractListFacts(notes) {
  const facts = [];
  const lines = String(notes || "").split(/\r?\n/);

  let currentHeading = "";

  for (const rawLine of lines) {
    const original = String(rawLine || "").trim();
    const line = cleanText(rawLine);

    if (!line) continue;

    const headingMatch = line.match(/^([^:]{2,90}):$/);

    if (headingMatch && isUsableLabel(headingMatch[1])) {
      currentHeading = cleanText(headingMatch[1]);
      continue;
    }

    const itemMatch = original.match(/^\s*(?:[-*•●▪◦]|\d+[.)])\s+(.{3,220})$/);

    if (!itemMatch || !currentHeading) continue;

    const answer = cleanText(itemMatch[1]);

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

// Extract additional facts from online research articles.
function extractResearchFacts(sentences) {
  const facts = [];

  const predicate =
    /\b(?:is|are|was|were|means|refers to|consists of|includes|allows|requires|causes|leads to|results in|prevents|reduces|increases|produces|has|have)\b/i;

  for (const sentence of sentences) {
    if (sentence.length < 35 || sentence.length > 240) {
      continue;
    }

    if (/^(?:there is|there are|in this article|according to)\b/i.test(sentence)) {
      continue;
    }

    const match = sentence.match(predicate);

    if (!match || match.index < 2 || match.index > 100) {
      continue;
    }

    let label = sentence
      .slice(0, match.index)
      .replace(/\([^)]*\)/g, " ")
      .replace(/\[[^\]]*\]/g, " ")
      .split(/,|;|\bor\b/i)[0];

    label = cleanText(label)
      .split(/\s+/)
      .slice(0, 5)
      .join(" ");

    if (!isUsableLabel(label) || !isUsableAnswer(sentence)) {
      continue;
    }

    facts.push({
      label,
      answer: sentence,
      type: classifyFact(label, sentence),
      source: sentence,
      sourceType: "research_sentence"
    });
  }

  return facts;
}
// Remove duplicate facts while preserving their original order.
function uniqueFacts(facts) {
  const seen = new Set();
  return facts.filter(fact => {
    const key =
      `${normalize(fact.label)}|${normalize(fact.answer)}`;
    if (!fact.label || !fact.answer || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
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

  return overlap / Math.min(a.size, b.size);
}
function selectDistractors(fact, candidates, researchMode = false) {
  const answerKey = normalize(fact.answer);

  const answerLimit = researchMode ? 1.01 : 0.6;
  const labelLimit = researchMode ? 1.01 : 0.7;
  const optionLimit = researchMode ? 1.01 : 0.6;

  const ranked = candidates
    .filter(candidate => {
      const candidateKey = normalize(candidate.answer);

      if (!candidateKey || candidateKey === answerKey) {
        return false;
      }

      if (
        !researchMode &&
        (
          candidateKey.includes(answerKey) ||
          answerKey.includes(candidateKey)
        )
      ) {
        return false;
      }

      if (
        similarityScore(fact.answer, candidate.answer) >= answerLimit
      ) {
        return false;
      }

      if (
        similarityScore(fact.label, candidate.label) >= labelLimit
      ) {
        return false;
      }

      return true;
    })
    .map(candidate => ({
      candidate,
      score:
        (candidate.type === fact.type ? 2 : 0) +
        similarityScore(
          `${fact.label} ${fact.answer}`,
          `${candidate.label} ${candidate.answer}`
        )
    }))
    .sort((a, b) => b.score - a.score);

  const selected = [];
  const seenAnswers = new Set([answerKey]);

  for (const item of ranked) {
    const candidate = item.candidate;
    const key = normalize(candidate.answer);

    if (seenAnswers.has(key)) continue;

    const duplicate = selected.some(existing =>
      similarityScore(existing, candidate.answer) >= optionLimit
    );

    if (duplicate) continue;

    selected.push(candidate.answer);
    seenAnswers.add(key);

    if (selected.length === 3) break;
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

function buildExplanation(fact) {
  const text = `${fact.label} ${fact.answer}`.toLowerCase();

  const explanations = [
    {
      pattern: /\b(rubor|redness)\b/,
      text: "Rubor means redness, one of the classic signs of inflammation. Increased blood flow contributes to this change."
    },
    {
      pattern: /\b(calor|heat)\b/,
      text: "Calor means heat. Increased blood flow to inflamed tissue contributes to the rise in local temperature."
    },
    {
      pattern: /\b(tumor|swelling)\b/,
      text: "Tumor is the traditional term for swelling among the classic signs of inflammation. Fluid accumulation in tissues commonly contributes to swelling."
    },
    {
      pattern: /\bdolor\b/,
      text: "Dolor means pain. Inflammation can stimulate sensory nerve endings through inflammatory mediators and tissue pressure."
    },
    {
      pattern: /\bfunctio laesa\b/,
      text: "Functio laesa means impaired or lost function. Pain, swelling and tissue damage can interfere with normal function."
    },
    {
      pattern: /\bchronic inflammation\b/,
      text: "Chronic inflammation is prolonged inflammation that may persist for weeks, months or years."
    }
  ];

  const match = explanations.find(item => item.pattern.test(text));

  if (match) return match.text;

  if (fact.source && fact.source !== fact.answer) {
    return `Source note: ${fact.source}`;
  }

  return `The source material identifies this as a relevant fact about ${fact.label}. Review the cited material to confirm the context and details.`;
}

function makeQuestion(fact, facts, researchMode = false) {
  const distractors = selectDistractors(
    fact,
    facts.filter(candidate => candidate !== fact),
    researchMode
  );

  // Four options are required: one correct answer and three distractors.
  if (distractors.length !== 3) return null;

  const optionTexts = shuffle([fact.answer, ...distractors]);

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
    explanation: buildExplanation(fact),
    source: researchMode ? "web_research" : "provided_notes"
  };
}

function generateMCQs({
  topic = "General Studies",
  notes = "",
  count = 10,
  difficulty = "medium",
  researchMode = false
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
    ...extractStatementFacts(sentences),
    ...(researchMode ? extractResearchFacts(sentences) : [])
  ]);

  const questions = [];
  const seenQuestions = new Set();
  const seenAnswers = new Set();

  for (const fact of shuffle(facts)) {
    if (questions.length >= count) break;

    const questionKey =
      `${normalize(fact.label)}|${normalize(fact.answer)}`;

    const answerKey = normalize(fact.answer);

    if (
      seenQuestions.has(questionKey) ||
      seenAnswers.has(answerKey)
    ) {
      continue;
    }

    const question = makeQuestion(fact, facts, researchMode);

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
  // Fallback for research articles that do not match
  // the strict study-note extraction patterns.
  if (researchMode && questions.length === 0) {
    const fallbackFacts = [];
    const fallbackSeen = new Set();

    for (const sentence of sentences) {
      if (
        sentence.length < 35 ||
        sentence.length > 240 ||
        !isUsableAnswer(sentence)
      ) {
        continue;
      }

      const predicate = sentence.match(
        /\b(?:is defined as|refers to|means|is characterized by|is associated with|causes?|leads to|results in|includes|requires|prevents|reduces|increases|produces|has|have|is|are|was|were)\b/i
      );

      let label = predicate &&
        predicate.index >= 2 &&
        predicate.index <= 100
        ? sentence.slice(0, predicate.index)
        : "";

      label = cleanText(label)
        .replace(/\([^)]*\)/g, " ")
        .split(/[,;:]|\bor\b/i)[0];

      label = cleanText(label)
        .split(/\s+/)
        .slice(0, 5)
        .join(" ");

      if (!isUsableLabel(label)) {
        label = cleanTopic;
      }

      const key =
        `${normalize(label)}|${normalize(sentence)}`;

      if (fallbackSeen.has(key)) continue;

      fallbackSeen.add(key);

      fallbackFacts.push({
        label,
        answer: sentence,
        type: classifyFact(label, sentence),
        source: sentence,
        sourceType: "research_fallback"
      });
    }

    for (const fact of shuffle(fallbackFacts)) {
      if (questions.length >= count) break;

      const answerKey = normalize(fact.answer);

      if (seenAnswers.has(answerKey)) continue;

      const question = makeQuestion(
        fact,
        fallbackFacts,
        true
      );

      if (!question) continue;

      const questionKey =
        `${normalize(fact.label)}|${answerKey}`;

      if (seenQuestions.has(questionKey)) continue;

      seenQuestions.add(questionKey);
      seenAnswers.add(answerKey);

      questions.push({
        id: questions.length + 1,
        topic: cleanTopic,
        difficulty,
        ...question
      });
    }
  }
  return {
    success: questions.length > 0,
    engine: researchMode
      ? "devtools-rule-based-mcq-v6.1-research"
      : "devtools-rule-based-mcq-v6.1",
    topic: cleanTopic,
    difficulty,
    requestedCount: count,
    generatedCount: questions.length,
    questions,
    message: questions.length === count
      ? "Questions generated. Review the source material to confirm accuracy before using them in an examination."
      : questions.length > 0
        ? `Generated ${questions.length} of ${count} requested questions. More distinct source facts may be needed.`
        : "No suitable questions could be generated from these facts. Try structured notes or a more specific research topic."
  };
}

module.exports = {
  generateMCQs
};
