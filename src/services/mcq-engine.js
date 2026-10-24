// DevTools API — MCQ Engine v5.0
// Rule-based MCQ generation using supplied notes only.
// No paid AI API required.
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
function isUsable(value, min = 8, max = 260) {
  const text = cleanText(value);

  if (text.length < min || text.length > max) {
    return false;
  }

  // Reject headings, page labels, and document metadata.
  if (
    /^(chapter|unit|contents|references|bibliography|page\s+\d+|table of contents)\b/i.test(text)
  ) {
    return false;
  }

  // Reject vague or incomplete labels.
  if (
    /^(it|this|that|these|those|they|he|she|we|you|there|here|which|what|who|where|when|how|as|because|however|and|or|but)\b/i.test(text)
  ) {
    return false;
  }

  // Reject incomplete phrases ending in connecting words.
  if (
    /\b(the|a|an|of|to|for|with|from|and|or|as|is|are|was|were|that|which|into|by|on|at|if|when|because)$/i.test(text)
  ) {
    return false;
  }

  // Reject standalone headings that are not meaningful answer statements.
  if (
    /^[A-Z0-9\s()/-]{2,45}$/.test(text) &&
    !/[.!?:]/.test(text) &&
    text.split(/\s+/).length <= 5
  ) {
    return false;
  }

  return /[a-z]/i.test(text);
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
    const match = line.match(/^([^:]{2,90}):\s*(.{8,260})$/);
    if (!match) continue;
    const label = cleanText(match[1]);
    const answer = cleanText(match[2]);
    if (!isUsable(label, 2, 90) || !isUsable(answer, 8, 260)) {
      continue;
    }
    if (/[.!?]$/.test(label)) continue;
    if (
      /^(chapter|unit|contents|references|page\s+\d+|here is|the following text)/i.test(label)
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
      if (!isUsable(label, 2, 70) || !isUsable(answer, 8, 220)) {
        continue;
      }
      facts.push({
        label,
        answer,
        type: "definitions",
        source: sentence
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
    if (headingMatch && isUsable(headingMatch[1], 2, 90)) {
      currentHeading = cleanText(headingMatch[1]);
      continue;
    }
    const itemMatch = line.match(/^(?:[-*•]|\d+[.)])\s+(.{8,220})$/);
    if (!itemMatch || !currentHeading) continue;
    const answer = cleanText(itemMatch[1]);
    if (!isUsable(answer, 8, 220)) continue;
    facts.push({
      label: currentHeading,
      answer,
      type: classifyFact(currentHeading, answer),
      source: `${currentHeading}: ${answer}`
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
// Compare subject words to avoid mixing obviously unrelated facts.
const STOP_WORDS = new Set([
  "about", "after", "again", "also", "among", "and", "are",
  "associated", "because", "before", "being", "between", "body",
  "can", "cause", "causes", "describes", "during", "each", "from",
  "have", "into", "in", "includes", "including", "into", "its",
  "may", "more", "most", "often", "only", "other", "over",
  "part", "result", "results", "should", "some", "such", "that",
  "the", "their", "them", "then", "there", "these", "this",
  "those", "through", "under", "used", "using", "very", "which",
  "while", "with", "within"
]);
function getKeywords(value) {
  return new Set(
    normalize(value)
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter(word =>
        word.length >= 4 &&
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
  return overlap / Math.max(a.size, b.size);
}
function selectDistractors(fact, candidates) {
  const answerKey = normalize(fact.answer);
  const labelKey = normalize(fact.label);
  const ranked = candidates
    .filter(candidate => {
      const candidateKey = normalize(candidate.answer);
      if (candidateKey === answerKey) return false;
      if (candidateKey.includes(answerKey) || answerKey.includes(candidateKey)) {
        return false;
      }
      if (normalize(candidate.label) === labelKey) return false;
      // Avoid repeating a fact with a nearly identical answer.
      if (similarityScore(fact.answer, candidate.answer) > 0.8) {
        return false;
      }
      return true;
    })
    .map(candidate => {
      const sameType = candidate.type === fact.type ? 1 : 0;
      const subjectSimilarity = similarityScore(
        `${fact.label} ${fact.answer}`,
        `${candidate.label} ${candidate.answer}`
      );
      const labelSimilarity = similarityScore(
        fact.label,
        candidate.label
      );
      return {
        candidate,
        score: sameType * 3 + subjectSimilarity * 2 + labelSimilarity
      };
    })
    .sort((a, b) => b.score - a.score);
  const selected = [];
  const seenAnswers = new Set();
  for (const item of ranked) {
    const candidate = item.candidate;
    const key = normalize(candidate.answer);
    if (seenAnswers.has(key)) continue;
    // Prefer alternatives with related subjects.
    // Do not fill the question with unrelated material.
    if (item.score < 0.5) continue;
    selected.push(candidate.answer);
    seenAnswers.add(key);
    if (selected.length === 3) break;
  }
  return selected;
}
function buildQuestionText(fact) {
  switch (fact.type) {
    case "causes":
      return `According to the supplied notes, which statement identifies a cause or risk factor related to ${fact.label}?`;
    case "symptoms":
      return `According to the supplied notes, which statement describes a sign or symptom related to ${fact.label}?`;
    case "interventions":
      return `According to the supplied notes, which action is recommended for ${fact.label}?`;
    case "complications":
      return `According to the supplied notes, which statement identifies a complication of ${fact.label}?`;
    case "definitions":
      return `According to the supplied notes, what does ${fact.label} mean?`;
    case "functions":
      return `According to the supplied notes, which statement describes the function of ${fact.label}?`;
    case "importance":
      return `According to the supplied notes, which statement describes the importance of ${fact.label}?`;
    default:
      return `According to the supplied notes, which statement is associated with ${fact.label}?`;
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
  // Quality first: never invent missing options.
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
    ...extractDefinitionFacts(sentences),
    ...extractListFacts(notes)
  ]);
  const questions = [];
  const seenQuestions = new Set();
  const seenAnswers = new Set();
  const shuffledFacts = shuffle(facts);
  for (const fact of shuffledFacts) {
    if (questions.length >= count) break;
    const questionKey = normalize(fact.label);
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
    engine: "devtools-rule-based-mcq-v5.0",
    topic: cleanTopic,
    difficulty,
    requestedCount: count,
    generatedCount: questions.length,
    questions,
    message: questions.length === count
      ? "Questions generated from supplied notes. Review for accuracy before examination use."
      : questions.length > 0
        ? `Generated ${questions.length} of ${count} requested questions. The notes may not contain enough suitable facts and distractors.`
        : "No suitable questions could be generated. Provide more structured notes with several related facts."
  };
}
module.exports = {
  generateMCQs
};
