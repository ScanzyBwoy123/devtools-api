// DevTools API v1.6 — General-Purpose Distractor Engine
// Rule-based answer generation for multiple subjects.
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

function splitSentences(notes) {
  return String(notes || "")
    .replace(/\r/g, "\n")
    .split(/(?<=[.!?])\s+|\n+/)
    .map(cleanText)
    .filter(sentence => sentence.length >= 15);
}

// Extract meaningful phrases instead of isolated filler words.
function extractCandidates(notes) {
  const sentences = splitSentences(notes);
  const candidates = [];

  const stopWords = new Set([
    "about", "after", "again", "also", "because",
    "before", "being", "between", "could", "during",
    "each", "from", "have", "into", "more", "most",
    "other", "same", "should", "some", "than",
    "that", "their", "them", "then", "there", "these",
    "they", "this", "those", "through", "under",
    "very", "were", "what", "when", "where", "which",
    "while", "with", "would", "your", "and", "are",
    "but", "for", "has", "its", "not", "the", "was",
    "who", "will", "you", "can", "may", "use", "used",
    "using", "all", "any", "one", "two", "is", "in",
    "of", "to", "a", "an", "as", "at", "by", "on",
    "or", "if", "it", "helps", "help", "does"
  ]);

  for (const sentence of sentences) {
    // Capture the subject of a definition.
    const definition = sentence.match(
      /^(.+?)\s+is\s+(?:a|an|the)\s+(.+?)[.!?]*$/i
    );

    if (definition) {
      candidates.push(cleanText(definition[1]));
      candidates.push(cleanText(definition[2]));
    }

    // Capture purpose statements.
    const purpose = sentence.match(
      /^(.+?)\s+is\s+(?:used|performed|carried out)\s+to\s+(.+?)[.!?]*$/i
    );

    if (purpose) {
      candidates.push(cleanText(purpose[1]));
      candidates.push(cleanText(purpose[2]));
    }

    // Capture function statements.
    const functionMatch = sentence.match(
      /^(.+?)\s+(?:removes|absorbs|produces|measures|monitors|examines|prevents|contains|provides|causes|requires|increases|decreases)\s+(.+?)[.!?]*$/i
    );

    if (functionMatch) {
      candidates.push(cleanText(functionMatch[1]));
      candidates.push(cleanText(functionMatch[2]));
    }

    // Capture useful multiword concepts from the notes.
    const words = sentence.match(
      /\b[A-Za-z][A-Za-z'-]*\b/g
    ) || [];

    let phrase = [];

    for (const word of words) {
      if (stopWords.has(word.toLowerCase())) {
        if (phrase.length >= 2) {
          candidates.push(phrase.join(" "));
        }

        phrase = [];
        continue;
      }

      phrase.push(word);

      if (phrase.length >= 4) {
        candidates.push(phrase.join(" "));
        phrase.shift();
      }
    }

    if (phrase.length >= 2) {
      candidates.push(phrase.join(" "));
    }
  }

  return uniqueValues(candidates)
    .filter(value => value.length >= 4)
    .filter(value => value.length <= 100);
}

function generateOptions(answer, candidates = []) {
  const correctAnswer = cleanText(answer);

  if (!correctAnswer) {
    throw new Error("A correct answer is required.");
  }

  const correct = normalize(correctAnswer);

  const alternatives = uniqueValues(candidates)
    .filter(value => normalize(value) !== correct)
    .filter(value => value.length >= 4 && value.length <= 100)
    .filter(value => {
      const candidate = normalize(value);

      // Avoid options that merely repeat the correct answer.
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
        "Not enough distinct answer alternatives were found in the notes."
    };
  }

  // Prefer options with lengths reasonably close to the answer.
  const ranked = alternatives
    .map(value => ({
      value,
      score: Math.abs(value.length - correctAnswer.length)
    }))
    .sort((a, b) => a.score - b.score);

  const pool = ranked
    .slice(0, Math.min(15, ranked.length))
    .map(item => item.value);

  const selected = shuffle(pool).slice(0, 3);
  const choices = shuffle([correctAnswer, ...selected]);

  return {
    success: true,
    options: choices.map((text, index) => ({
      id: String.fromCharCode(65 + index),
      text,
      isCorrect: normalize(text) === correct
    }))
  };
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
