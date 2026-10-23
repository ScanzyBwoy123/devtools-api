// DevTools API v1.7 — Improved Distractor Engine
// Rule-based options for multiple subjects.
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

const WEAK_WORDS = new Set([
  "helps", "help", "affects", "affect",
  "remove", "removes", "removed", "removing",
  "examine", "examines", "examined",
  "created", "create", "creates",
  "used", "using", "uses",
  "provides", "provide", "provided",
  "causes", "cause", "caused",
  "produces", "produce", "produced",
  "increases", "increase", "decreases",
  "decrease", "requires", "require",
  "contains", "contain", "throughout",
  "according", "following", "above",
  "below", "between", "within",
  "therefore", "however", "another"
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

function isUsefulCandidate(value, answer) {
  const candidate = normalize(value);
  const correct = normalize(answer);

  if (!candidate || candidate === correct) {
    return false;
  }

  if (candidate.length < 4 || candidate.length > 100) {
    return false;
  }

  // Reject standalone weak words.
  if (WEAK_WORDS.has(candidate)) {
    return false;
  }

  // Reject options that are merely parts of the answer.
  if (
    candidate.includes(correct) ||
    correct.includes(candidate)
  ) {
    return false;
  }

  // Reject options that contain only weak words.
  const words = candidate.match(/[a-z]+/g) || [];

  if (
    words.length === 0 ||
    words.every(word => WEAK_WORDS.has(word))
  ) {
    return false;
  }

  return true;
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
        "Not enough suitable distractors were found. Provide more detailed study notes."
    };
  }

  // Prefer alternatives with a similar length.
  const ranked = alternatives
    .map(value => {
      const lengthDifference = Math.abs(
        value.length - correctAnswer.length
      );

      const candidateWords = new Set(
        normalize(value).split(/\s+/)
      );

      const answerWords = new Set(
        normalize(correctAnswer).split(/\s+/)
      );

      let sharedWords = 0;

      for (const word of candidateWords) {
        if (answerWords.has(word)) {
          sharedWords++;
        }
      }

      return {
        value,
        score: lengthDifference + sharedWords * 20
      };
    })
    .sort((a, b) => a.score - b.score);

  // Keep a wider pool to avoid always selecting the same options.
  const pool = ranked
    .slice(0, Math.min(20, ranked.length))
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
      isCorrect: normalize(text) === normalize(correctAnswer)
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

  for (const sentence of sentences) {
    // Keep complete statements as possible alternatives.
    if (sentence.length >= 15 && sentence.length <= 100) {
      candidates.push(sentence);
    }

    // Extract meaningful individual terms.
    const words = sentence.match(
      /\b[A-Za-z][A-Za-z'-]*\b/g
    ) || [];

    for (const word of words) {
      if (
        word.length >= 4 &&
        !WEAK_WORDS.has(word.toLowerCase())
      ) {
        candidates.push(word);
      }
    }

    // Extract short phrases for more useful alternatives.
    const phrases = sentence.match(
      /\b[A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){1,3}\b/g
    ) || [];

    candidates.push(...phrases);
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
