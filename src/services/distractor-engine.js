// DevTools API v4.0
// Quality-controlled, rule-based distractor engine.
// No paid AI API required.

const WEAK_WORDS = new Set([
  "helps", "help", "affects", "affect", "used", "using",
  "uses", "use", "provides", "provide", "causes", "cause",
  "produces", "produce", "increases", "increase", "decreases",
  "decrease", "requires", "require", "contains", "contain",
  "according", "following", "above", "below", "between",
  "within", "therefore", "however", "another", "this", "that",
  "these", "those", "they", "them", "their", "which", "where",
  "when", "what", "with", "from", "into", "also", "such",
  "than", "then", "been", "being", "were", "was", "are",
  "and", "the", "for", "but", "not", "can", "may", "will",
  "because", "although", "while", "who", "whose", "have",
  "has", "had", "does", "did", "doing", "done", "its",
  "commonly", "usually", "generally", "often", "possible"
]);

const GENERIC_WORDS = new Set([
  "condition", "process", "method", "system", "thing",
  "things", "example", "examples", "important", "different",
  "various", "result", "results", "factor", "factors",
  "type", "types", "part", "parts", "activity", "activities",
  "information", "definition", "definitions", "function",
  "functions", "purpose", "purposes", "meaning", "concept",
  "concepts", "area", "areas", "aspect", "aspects"
]);

const BLOCKED_PHRASES = new Set([
  "notes", "study", "studies", "chapter", "unit", "topic",
  "example", "examples", "question", "questions", "answer",
  "answers", "introduction", "conclusion", "following",
  "above", "below", "definition", "definitions"
]);

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,;:.]+|[,;:.]+$/g, "")
    .replace(/[.!?]+$/g, "")
    .trim();
}

function normalize(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getWords(value) {
  return normalize(value).match(/\b[a-z][a-z'-]*\b/g) || [];
}

function uniqueValues(values) {
  const seen = new Set();
  const result = [];

  for (const item of values) {
    const value = cleanText(item);
    const key = normalize(value);

    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(value);
  }

  return result;
}

function shuffle(values) {
  const result = [...values];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function isSentenceFragment(value) {
  const text = normalize(value);
  const words = getWords(text);

  if (words.length < 2) return false;

  if (
    /^(the|a|an|and|or|but|because|although|while|when|which|who|that|with|from|into|such as|according to)\b/.test(text)
  ) {
    return true;
  }

  if (
    /\b(and|or|because|although|while|when|which|who|that|with|from|into|of|to|for|by|in|on|at|as)$/.test(text)
  ) {
    return true;
  }

  return words.length >= 7;
}

function isUsefulCandidate(value, answer) {
  const candidate = normalize(value);
  const correct = normalize(answer);

  if (!candidate || !correct || candidate === correct) {
    return false;
  }

  if (candidate.length < 3 || candidate.length > 80) {
    return false;
  }

  // Reject candidates containing the complete correct answer.
  if (
    candidate.includes(correct) ||
    correct.includes(candidate)
  ) {
    return false;
  }

  const words = getWords(candidate);

  if (words.length === 0 || words.length > 6) {
    return false;
  }

  if (isSentenceFragment(candidate)) {
    return false;
  }

  if (
    words.every(word =>
      WEAK_WORDS.has(word) ||
      GENERIC_WORDS.has(word)
    )
  ) {
    return false;
  }

  if (BLOCKED_PHRASES.has(candidate)) {
    return false;
  }

  // Reject options that differ only in word order.
  const answerWords = new Set(getWords(correct));
  const candidateWords = new Set(words);

  if (
    answerWords.size === candidateWords.size &&
    [...answerWords].every(word => candidateWords.has(word))
  ) {
    return false;
  }

  return true;
}

// Measures surface similarity, not scientific meaning.
// Lower scores indicate closer textual structure.
function candidateScore(value, answer) {
  const candidateWords = new Set(getWords(value));
  const answerWords = new Set(getWords(answer));

  let sharedWords = 0;

  for (const word of candidateWords) {
    if (answerWords.has(word)) sharedWords++;
  }

  const lengthDifference = Math.abs(
    normalize(value).length - normalize(answer).length
  );

  const wordCountDifference = Math.abs(
    candidateWords.size - answerWords.size
  );

  return (
    lengthDifference +
    wordCountDifference * 4 +
    sharedWords * 12
  );
}

// Detects basic grammatical and structural compatibility.
// It does not establish semantic relevance.
function structureScore(value, answer) {
  const candidateWords = getWords(value);
  const answerWords = getWords(answer);

  let score = 0;

  if (candidateWords.length !== answerWords.length) {
    score += Math.abs(
      candidateWords.length - answerWords.length
    ) * 3;
  }

  const candidateStartsUpper = /^[A-Z]/.test(cleanText(value));
  const answerStartsUpper = /^[A-Z]/.test(cleanText(answer));

  if (candidateStartsUpper !== answerStartsUpper) {
    score += 1;
  }

  return score;
}

function generateOptions(answer, candidates = []) {
  const correctAnswer = cleanText(answer);

  if (!correctAnswer) {
    throw new Error("A correct answer is required.");
  }

  const correctKey = normalize(correctAnswer);

  const alternatives = uniqueValues(
    Array.isArray(candidates) ? candidates : []
  ).filter(value =>
    isUsefulCandidate(value, correctAnswer)
  );

  if (alternatives.length < 3) {
    return {
      success: false,
      options: [],
      message:
        "Not enough suitable distractors were found. Provide more varied study notes."
    };
  }

  const ranked = alternatives
    .map(value => ({
      value,
      score:
        candidateScore(value, correctAnswer) +
        structureScore(value, correctAnswer)
    }))
    .sort((a, b) => a.score - b.score);

  // Limit selection to the strongest candidates.
  const pool = ranked
    .slice(0, Math.min(30, ranked.length))
    .map(item => item.value);

  const selected = [];
  const selectedKeys = new Set([correctKey]);

  // Prefer candidates with different wording and structures.
  for (const candidate of shuffle(pool)) {
    const key = normalize(candidate);

    if (!key || selectedKeys.has(key)) continue;

    const tooSimilar = selected.some(existing => {
      const existingWords = new Set(getWords(existing));
      const candidateWords = new Set(getWords(candidate));

      if (!existingWords.size || !candidateWords.size) {
        return false;
      }

      let shared = 0;

      for (const word of candidateWords) {
        if (existingWords.has(word)) shared++;
      }

      const overlap =
        shared / Math.max(
          existingWords.size,
          candidateWords.size
        );

      return overlap >= 0.8;
    });

    if (tooSimilar) continue;

    selected.push(candidate);
    selectedKeys.add(key);

    if (selected.length === 3) break;
  }

  if (selected.length !== 3) {
    return {
      success: false,
      options: [],
      message:
        "Four distinct options could not be generated without excessive wording overlap."
    };
  }

  const choices = shuffle([
    correctAnswer,
    ...selected
  ]);

  const options = choices.map((text, index) => ({
    id: String.fromCharCode(65 + index),
    text,
    isCorrect: normalize(text) === correctKey
  }));

  const correctCount = options.filter(
    option => option.isCorrect
  ).length;

  const uniqueCount = new Set(
    options.map(option => normalize(option.text))
  ).size;

  if (correctCount !== 1 || uniqueCount !== 4) {
    return {
      success: false,
      options: [],
      message: "Option validation failed."
    };
  }

  return {
    success: true,
    options
  };
}

function extractCandidates(notes) {
  const text = String(notes || "");

  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(cleanText)
    .filter(Boolean);

  const candidates = [];

  for (const sentence of sentences) {
    const words = getWords(sentence);

    // Extract potentially meaningful terms.
    for (const word of words) {
      if (
        word.length >= 4 &&
        !WEAK_WORDS.has(word) &&
        !GENERIC_WORDS.has(word) &&
        !BLOCKED_PHRASES.has(word)
      ) {
        candidates.push(word);
      }
    }

    // Extract short phrases.
    const phrases = sentence.match(
      /\b[A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){1,3}\b/g
    ) || [];

    for (const phrase of phrases) {
      const key = normalize(phrase);
      const phraseWords = getWords(phrase);

      if (
        phraseWords.length >= 2 &&
        phraseWords.length <= 4 &&
        !BLOCKED_PHRASES.has(key) &&
        !isSentenceFragment(phrase) &&
        phraseWords.some(word =>
          !WEAK_WORDS.has(word) &&
          !GENERIC_WORDS.has(word) &&
          !BLOCKED_PHRASES.has(word)
        )
      ) {
        candidates.push(phrase);
      }
    }
  }

  return uniqueValues(candidates);
}

function generateOptionsFromNotes(answer, notes) {
  return generateOptions(answer, extractCandidates(notes));
}

module.exports = {
  generateOptions,
  extractCandidates,
  generateOptionsFromNotes
};
