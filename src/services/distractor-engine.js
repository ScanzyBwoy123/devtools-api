// DevTools API v1.6 — Distractor Engine
// Selects relevant answer options from supplied study notes.
// No paid AI API required.
function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,;:.]+|[,;:.]+$/g, "");
}
function normalize(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[.!?]+$/g, "");
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
// Remove introductory words that do not form part
// of a useful answer choice.
function cleanCandidate(value) {
  return cleanText(value)
    .replace(/^(a|an|the)\s+/i, "")
    .replace(/^(is|are|was|were)\s+/i, "")
    .replace(/^(used to|use to)\s+/i, "")
    .trim();
}
// Split study notes into sentences.
function splitSentences(notes) {
  return String(notes || "")
    .replace(/\r/g, "\n")
    .split(/(?<=[.!?])\s+|\n+/)
    .map(cleanText)
    .filter(sentence => sentence.length >= 15);
}
// Extract meaningful terms and short phrases.
function extractCandidates(notes) {
  const sentences = splitSentences(notes);
  const candidates = [];
  for (const sentence of sentences) {
    // Keep the complete sentence as a possible option.
    if (sentence.length <= 100) {
      candidates.push(sentence);
    }
    // Extract phrases from common definition patterns.
    const definition = sentence.match(
      /^(.+?)\s+is\s+(?:a|an|the)\s+(.+?)[.!?]*$/i
    );
    if (definition) {
      candidates.push(cleanCandidate(definition[1]));
      candidates.push(cleanCandidate(definition[2]));
    }
    // Extract purpose phrases.
    const purpose = sentence.match(
      /^(.+?)\s+is\s+(?:used|performed|carried out)\s+to\s+(.+?)[.!?]*$/i
    );
    if (purpose) {
      candidates.push(cleanCandidate(purpose[1]));
      candidates.push(cleanCandidate(purpose[2]));
    }
    // Extract phrases from function statements.
    const functionMatch = sentence.match(
      /^(.+?)\s+(?:removes|absorbs|produces|measures|monitors|examines|prevents|contains|provides|causes|requires)\s+(.+?)[.!?]*$/i
    );
    if (functionMatch) {
      candidates.push(cleanCandidate(functionMatch[1]));
      candidates.push(cleanCandidate(functionMatch[2]));
    }
    // Extract meaningful words and short phrases.
    const words = sentence.match(
      /\b[A-Za-z][A-Za-z'-]*\b/g
    ) || [];
    candidates.push(
      ...words.filter(word => word.length >= 5)
    );
  }
  return uniqueValues(candidates)
    .filter(value => value.length >= 3)
    .filter(value => value.length <= 100);
}
// Identify whether two answers have an exact match.
function sameAnswer(first, second) {
  return normalize(first) === normalize(second);
}
// Create four options using only supplied material.
function generateOptions(answer, candidates = []) {
  const correctAnswer = cleanText(answer);
  if (!correctAnswer) {
    throw new Error("A correct answer is required.");
  }
  const alternatives = uniqueValues(candidates)
    .filter(value => !sameAnswer(value, correctAnswer))
    .filter(value => value.length <= 100)
    .filter(value => {
      // Avoid options that merely repeat the answer.
      const correct = normalize(correctAnswer);
      const candidate = normalize(value);
      if (correct.length < 5 || candidate.length < 5) {
        return true;
      }
      return !(
        candidate.includes(correct) ||
        correct.includes(candidate)
      );
    });
  if (alternatives.length < 3) {
    return {
      success: false,
      options: [],
      message:
        "Not enough distinct alternatives were found in the supplied notes."
    };
  }
  // Prefer shorter answer choices because they are easier
  // to read in an examination interface.
  const ranked = alternatives
    .map(value => ({
      value,
      score: Math.abs(
        value.length - correctAnswer.length
      )
    }))
    .sort((a, b) => a.score - b.score);
  // Randomize among the more similarly sized candidates.
  const pool = ranked
    .slice(0, Math.min(12, ranked.length))
    .map(item => item.value);
  const selected = shuffle(pool).slice(0, 3);
  const choices = shuffle([correctAnswer, ...selected]);
  return {
    success: true,
    options: choices.map((text, index) => ({
      id: String.fromCharCode(65 + index),
      text,
      isCorrect: sameAnswer(text, correctAnswer)
    }))
  };
}
function generateOptionsFromNotes(answer, notes) {
  const candidates = extractCandidates(notes);
  return generateOptions(answer, candidates);
}
module.exports = {
  generateOptions,
  extractCandidates,
  generateOptionsFromNotes
};
