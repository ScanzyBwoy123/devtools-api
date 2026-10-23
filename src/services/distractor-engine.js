// DevTools API v1.8 — Improved Distractor Engine
// Rule-based options for multiple subjects.
// No paid AI API required.
function cleanText(value) {
  return String(value || "")
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
const WEAK_WORDS = new Set([
  "helps", "help", "affects", "affect",
  "remove", "removes", "removed", "removing",
  "examine", "examines", "examined",
  "created", "create", "creates",
  "used", "using", "uses", "use",
  "provides", "provide", "provided",
  "causes", "cause", "caused",
  "produces", "produce", "produced",
  "increases", "increase", "decreases",
  "decrease", "requires", "require",
  "contains", "contain", "throughout",
  "according", "following", "above",
  "below", "between", "within",
  "therefore", "however", "another",
  "this", "that", "these", "those",
  "they", "them", "their", "which",
  "where", "when", "what", "with",
  "from", "into", "onto", "also",
  "such", "than", "then", "been",
  "being", "were", "was", "are",
  "and", "the", "for", "but",
  "not", "can", "may", "will"
]);
const GENERIC_WORDS = new Set([
  "condition", "process", "method", "system",
  "thing", "things", "example", "examples",
  "important", "different", "various",
  "following", "above", "below", "result",
  "results", "factor", "factors", "type",
  "types", "part", "parts", "activity"
]);
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
    [result[i], result[j]] = [
      result[j],
      result[i]
    ];
  }
  return result;
}
function getWords(value) {
  return normalize(value)
    .match(/\b[a-z][a-z'-]*\b/g) || [];
}
function isSentenceFragment(value) {
  const text = normalize(value);
  const words = getWords(text);
  if (words.length < 2) {
    return false;
  }
  // Reject common sentence fragments and unfinished clauses.
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
  // Sentence-like fragments are poor answers for most short-answer questions.
  if (words.length >= 5) {
    const hasVerb = words.some(word =>
      /^(is|are|was|were|be|been|being|has|have|had|does|do|did|helps|help|causes|cause|contains|contain|regulates|regulate|measures|measure|increases|increase|reduces|reduce|controls|control|produces|produce|prevents|prevent|provides|provide|includes|include|means|refer|refers|occurs|occur|affects|affect)$/.test(word)
    );
    if (hasVerb) {
      return true;
    }
  }
  return false;
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
  if (
    candidate.includes(correct) ||
    correct.includes(candidate)
  ) {
    return false;
  }
  if (isSentenceFragment(candidate)) {
    return false;
  }
  const words = getWords(candidate);
  if (words.length === 0 || words.length > 8) {
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
  // Reject candidates that are mostly generic language.
  const meaningfulWords = words.filter(word =>
    !WEAK_WORDS.has(word) &&
    !GENERIC_WORDS.has(word)
  );
  if (meaningfulWords.length === 0) {
    return false;
  }
  return true;
}
function candidateScore(value, answer) {
  const candidateWords = new Set(getWords(value));
  const answerWords = new Set(getWords(answer));
  let sharedWords = 0;
  for (const word of candidateWords) {
    if (answerWords.has(word)) {
      sharedWords++;
    }
  }
  const lengthDifference = Math.abs(
    normalize(value).length - normalize(answer).length
  );
  const wordCountDifference = Math.abs(
    candidateWords.size - answerWords.size
  );
  return (
    lengthDifference +
    wordCountDifference * 3 +
    sharedWords * 15
  );
}
function generateOptions(answer, candidates = []) {
  const correctAnswer = cleanText(answer);
  if (!correctAnswer) {
    throw new Error("A correct answer is required.");
  }
  const alternatives = uniqueValues(candidates)
    .filter(value =>
      isUsefulCandidate(value, correctAnswer)
    );
  if (alternatives.length < 3) {
    return {
      success: false,
      options: [],
      message:
        "Not enough suitable distractors were found. More varied study notes may be needed."
    };
  }
  // Rank alternatives using simple text-based heuristics.
  const ranked = alternatives
    .map(value => ({
      value,
      score: candidateScore(value, correctAnswer)
    }))
    .sort((a, b) => a.score - b.score);
  // Randomize a small pool of reasonably similar-length candidates.
  const poolSize = Math.min(15, ranked.length);
  const pool = ranked
    .slice(0, poolSize)
    .map(item => item.value);
  const selected = shuffle(pool).slice(0, 3);
  if (selected.length !== 3) {
    return {
      success: false,
      options: [],
      message: "Four distinct options could not be generated."
    };
  }
  const choices = shuffle([
    correctAnswer,
    ...selected
  ]);
  return {
    success: true,
    options: choices.map((text, index) => ({
      id: String.fromCharCode(65 + index),
      text,
            isCorrect:
        normalize(text) === normalize(correctAnswer)
    }))
  };
}
function extractCandidates(notes) {
  const text = String(notes || "");
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(cleanText)
    .filter(Boolean);
  const candidates = [];
  const blockedPhrases = new Set([
    "notes",
    "study",
    "studies",
    "chapter",
    "unit",
    "topic",
    "example",
    "examples",
    "question",
    "questions",
    "answer",
    "answers",
    "introduction",
    "conclusion",
    "definition",
    "definitions",
    "following",
    "above",
    "below"
  ]);
  for (const sentence of sentences) {
    const words = getWords(sentence);
    // Keep meaningful individual terms, not document labels.
    for (const word of words) {
      if (
        word.length >= 4 &&
        !WEAK_WORDS.has(word) &&
        !GENERIC_WORDS.has(word) &&
        !blockedPhrases.has(word)
      ) {
        candidates.push(word);
      }
    }
    // Extract short phrases that may be useful answer options.
    const phrases = sentence.match(
      /\b[A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){1,3}\b/g
    ) || [];
    for (const phrase of phrases) {
      const normalizedPhrase = normalize(phrase);
      const phraseWords = getWords(phrase);
      if (
        phraseWords.length >= 2 &&
        phraseWords.length <= 4 &&
        !blockedPhrases.has(normalizedPhrase) &&
        !isSentenceFragment(phrase) &&
        phraseWords.some(word =>
          !WEAK_WORDS.has(word) &&
          !GENERIC_WORDS.has(word) &&
          !blockedPhrases.has(word)
        )
      ) {
        candidates.push(phrase);
      }
    }
  }
  return uniqueValues(candidates);
}
function generateOptionsFromNotes(answer, notes) {
  return generateOptions(
    answer,
    extractCandidates(notes)
  );
}
module.exports = {
  generateOptions,
  extractCandidates,
  generateOptionsFromNotes
};
