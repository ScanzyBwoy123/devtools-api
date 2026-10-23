// DevTools API v1.5 — Distractor Engine
// Selects plausible incorrect answers from supplied study notes.
// No paid AI API required.

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value) {
  return cleanText(value).toLowerCase();
}

function uniqueValues(values) {
  const seen = new Set();

  return values
    .map(cleanText)
    .filter(value => {
      const key = normalize(value);

      if (!key || seen.has(key)) return false;

      seen.add(key);
      return true;
    });
}

function shuffle(values) {
  const result = [...values];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * Create four answer options.
 *
 * answer: correct answer
 * candidates: possible alternatives extracted from the notes
 * Returns null when four defensible options cannot be found.
 */
function generateOptions(answer, candidates = []) {
  const correctAnswer = cleanText(answer);

  if (!correctAnswer) {
    throw new Error("A correct answer is required.");
  }

  const alternatives = uniqueValues(candidates)
    .filter(value => normalize(value) !== normalize(correctAnswer))
    .filter(value => value.length <= 160);

  if (alternatives.length < 3) {
    return {
      success: false,
      options: [],
      message:
        "At least three distinct incorrect options are needed."
    };
  }

  const selected = shuffle(alternatives).slice(0, 3);
  const choices = shuffle([correctAnswer, ...selected]);

  return {
    success: true,
    options: choices.map((text, index) => ({
      id: String.fromCharCode(65 + index),
      text,
      isCorrect: normalize(text) === normalize(correctAnswer)
    }))
  };
}

/**
 * Extract candidate phrases from supplied notes.
 *
 * These phrases are possible distractors, not guaranteed
 * to be suitable for every question.
 */
function extractCandidates(notes) {
  const text = String(notes || "");

  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(cleanText)
    .filter(Boolean);

  const candidates = [];

  for (const sentence of sentences) {
    candidates.push(sentence);

    const words = sentence.match(
      /\b[A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,3}\b/g
    ) || [];

    candidates.push(...words);
  }

  return uniqueValues(candidates);
}

/**
 * Generate answer choices from study notes.
 */
function generateOptionsFromNotes(answer, notes) {
  const candidates = extractCandidates(notes);

  return generateOptions(answer, candidates);
}

module.exports = {
  generateOptions,
  extractCandidates,
  generateOptionsFromNotes
};
