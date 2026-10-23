// DevTools API — MCQ Engine v2.0
// Improved rule-based question generation.
// No paid AI API required.

const {
  generateOptions
} = require("./distractor-engine");

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "among",
  "because", "been", "before", "being", "between",
  "both", "could", "does", "doing", "during",
  "each", "from", "have", "having", "into",
  "more", "most", "other", "over", "same",
  "should", "some", "such", "than", "that",
  "their", "them", "then", "there", "these",
  "they", "this", "those", "through", "under",
  "very", "were", "what", "when", "where",
  "which", "while", "with", "would", "your",
  "and", "are", "but", "for", "has", "its",
  "not", "the", "was", "who", "will", "you",
  "can", "may", "use", "used", "using", "all",
  "any", "one", "two", "is", "in", "of", "to",
  "a", "an", "as", "at", "by", "on", "or",
  "if", "it", "according", "into", "which",
  "include", "includes", "including", "example",
  "examples", "following", "known", "called",
  "often", "usually", "generally", "also"
]);

const WEAK_WORDS = new Set([
  "remove", "removes", "removed", "removing",
  "helps", "help", "examine", "examines",
  "examined", "examination", "created",
  "create", "creates", "provides", "provide",
  "performed", "carried", "out", "causes",
  "cause", "increases", "decreases", "contains",
  "produces", "measures", "monitors", "prevents",
  "requires", "absorbs", "according", "using"
]);

function cleanText(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s,;:.–—-]+|[\s,;:.–—-]+$/g, "");
}

function normalize(text) {
  return cleanText(text)
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");
}

function splitSentences(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .split(/(?<=[.!?])\s+|\n+/)
    .map(cleanText)
    .filter(sentence => {
      if (sentence.length < 25) return false;
      if (sentence.length > 600) return false;

      // Reject navigation text and obvious incomplete fragments.
      if (/^(references|external links|see also|contents)\b/i.test(sentence)) {
        return false;
      }

      return /[A-Za-z]/.test(sentence);
    });
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getKeywords(text) {
  const words =
    String(text || "").match(/\b[A-Za-z][A-Za-z'-]*\b/g) || [];

  return [...new Set(
    words.filter(word => {
      const value = word.toLowerCase();

      return (
        word.length >= 4 &&
        !STOP_WORDS.has(value) &&
        !WEAK_WORDS.has(value)
      );
    })
  )];
}

function isUsableAnswer(answer) {
  const value = cleanText(answer);
  const normalized = normalize(value);

  if (value.length < 3 || value.length > 220) {
    return false;
  }

  if (/^(and|or|but|the|a|an|of|to|in|for)\b/i.test(value)) {
    return false;
  }

  if (/^(https?:|www\.)/i.test(value)) {
    return false;
  }

  if (/^[,;:.!?-]+$/.test(value)) {
    return false;
  }

  if (normalized.split(" ").length > 35) {
    return false;
  }

  return true;
}
function isUsableEntity(entity) {
const value = cleanText(entity);

if (!isUsableAnswer(value)) {
return false;
}

if (/^(because|although|however|therefore|other|another|this|that|these|those|it|they|he|she|we|you|also|during|after|before|when|while|which|who|such)\b/i.test(value)) {
return false;
}

if (/(\s*[,)]|(\s*)|,\s*)/.test(value)) {
return false;
}

if (/[,;:]$/.test(value)) {
return false;
}

return true;
}
// Extract straightforward facts from complete sentences.
function extractFact(sentence) {
  let match;

  // Example: "Osmosis is the movement of water..."
  match = sentence.match(
    /^(.{2,100}?)\s+is\s+(?:a|an|the)\s+(.{5,250})$/i
  );

  if (match) {
    const entity = cleanText(match[1]);
    const answer = cleanText(match[2]);

    if (
      isUsableAnswer(entity) &&
      isUsableAnswer(answer) &&
      !/[?]$/.test(entity)
    ) {
      return {
        entity,
        answer,
        type: "definition",
        sentence
      };
    }
  }

  // Example: "The kidneys filter waste from the blood."
  match = sentence.match(
    /^(.{2,100}?)\s+(filters|filter|produces|produce|measures|measure|monitors|monitor|prevents|prevent|absorbs|absorb|contains|contain|causes|cause|requires|require|increases|increase|decreases|decrease|removes|remove)\s+(.{5,220})$/i
  );

  if (match) {
    const entity = cleanText(match[1]);
    const answer = cleanText(
      `${match[2]} ${match[3]}`
    );

    if (
      isUsableAnswer(entity) &&
      isUsableAnswer(answer)
    ) {
      return {
        entity,
        answer,
        type: "function",
        sentence
      };
    }
  }

  // Example: "The procedure is used to remove fluid..."
  match = sentence.match(
    /^(.{2,100}?)\s+is\s+(?:used|performed|carried out)\s+to\s+(.{5,220})$/i
  );

  if (match) {
    const entity = cleanText(match[1]);
    const answer = cleanText(match[2]);

    if (
      isUsableAnswer(entity) &&
      isUsableAnswer(answer)
    ) {
      return {
        entity,
        answer,
        type: "purpose",
        sentence
      };
    }
  }

  return null;
}

function shuffle(items) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [
      result[j],
      result[i]
    ];
  }

  return result;
}

function uniqueCandidates(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const value = cleanText(item);
    const key = normalize(value);

    if (!isUsableAnswer(value) || !key || seen.has(key)) {
      continue;
    }

    if (WEAK_WORDS.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
}

function getAnswerCandidates(notes, facts) {
  const candidates = [];

  for (const fact of facts) {
    candidates.push(fact.entity);
    candidates.push(fact.answer);
    candidates.push(...getKeywords(fact.entity));
    candidates.push(...getKeywords(fact.answer));
  }

  for (const sentence of splitSentences(notes)) {
    candidates.push(...getKeywords(sentence));
  }

  return uniqueCandidates(candidates);
}

function makeOptions(answer, candidates) {
  const correctAnswer = cleanText(answer);
  const correct = normalize(correctAnswer);

  if (!isUsableAnswer(correctAnswer)) {
    return null;
  }

  const validCandidates = uniqueCandidates(candidates)
    .filter(candidate => {
      const value = normalize(candidate);

      if (!value || value === correct) {
        return false;
      }

      // Reject answers that contain one another.
      if (
        value.includes(correct) ||
        correct.includes(value)
      ) {
        return false;
      }

      // Reject options that are effectively identical.
      const answerWords = new Set(correct.split(/\s+/));
      const candidateWords = new Set(value.split(/\s+/));

      if (
        answerWords.size === candidateWords.size &&
        [...answerWords].every(word => candidateWords.has(word))
      ) {
        return false;
      }

      return true;
    });

  if (validCandidates.length < 3) {
    return null;
  }

  try {
    const result = generateOptions(
      correctAnswer,
      validCandidates
    );

    if (
      !result ||
      !result.success ||
      !Array.isArray(result.options) ||
      result.options.length !== 4
    ) {
      return null;
    }

    const options = result.options.map(option => ({
      ...option,
      text: cleanText(
        option.text ||
        option.label ||
        option.answer ||
        ""
      )
    }));

    const optionTexts = options.map(option =>
      normalize(option.text)
    );

    if (optionTexts.some(text => !text)) {
      return null;
    }

    // All four options must be distinct.
    if (new Set(optionTexts).size !== 4) {
      return null;
    }

    // Exactly one option must be marked correct.
    const correctOptions = options.filter(
      option => option.isCorrect === true
    );

    if (correctOptions.length !== 1) {
      return null;
    }

    // The correct option must match the intended answer.
    if (
      normalize(correctOptions[0].text) !== correct
    ) {
      return null;
    }

    return shuffle(options);
  } catch (error) {
    console.error("Option generation error:", error.message);
    return null;
  }
}

function makeDirectQuestion(fact, facts, candidates) {
  if (
    !fact ||
    !isUsableEntity(fact.entity) ||
    !isUsableAnswer(fact.answer)
  ) {
    return null;
  }

  const relatedFacts = facts.filter(item =>
    item.type === fact.type &&
    normalize(item.entity) !== normalize(fact.entity) &&
    normalize(item.answer) !== normalize(fact.answer) &&
    isUsableEntity(item.entity) &&
    isUsableAnswer(item.answer)
  );

  const alternatives = uniqueCandidates(
    relatedFacts.map(item => item.answer)
  ).filter(answer =>
    normalize(answer) !== normalize(fact.answer)
  );

  // Avoid generating a question without three distinct distractors.
  if (alternatives.length < 3) {
    return null;
  }

  const options = makeOptions(fact.answer, alternatives);

  if (!options) {
    return null;
  }

  let question;

  if (fact.type === "definition") {
    question = `Which statement best describes ${fact.entity}?`;
  } else if (fact.type === "purpose") {
    question = `What is the main purpose of ${fact.entity}?`;
  } else {
    question = `Which statement best describes the function of ${fact.entity}?`;
  }

  return {
    questionType: fact.type,
    question,
    options,
    answer: fact.answer,
    explanation: `According to the supplied notes: ${fact.sentence}`,
    source: "provided_notes"
  };
}
function makeClozeQuestion(sentence, candidates) {
const cleanSentence = cleanText(sentence);

if (
cleanSentence.length < 35 ||
cleanSentence.length > 500 ||
!/[.!?]$/.test(cleanSentence) ||
/^(because|although|however|therefore|other causes|another|this|that|these|those|it is|they are|such as)\b/i.test(cleanSentence)
) {
return null;
}

const keywords = getKeywords(cleanSentence);

if (!keywords.length) {
return null;
}

const answer = [...keywords]
.reverse()
.find(word => {
const pattern = new RegExp(
\\b${escapeRegExp(word)}\\b,
“i”
);

  return (
    word.length >= 5 &&
    pattern.test(cleanSentence) &&
    !WEAK_WORDS.has(word.toLowerCase()) &&
    /^[A-Za-z][A-Za-z-]*$/.test(word)
  );
});

if (!answer) {
return null;
}

const pattern = new RegExp(
\\b${escapeRegExp(answer)}\\b,
“i”
);

const blanked = cleanSentence.replace(
pattern,
“________”
);

if (
blanked === cleanSentence ||
blanked.length < 25 ||
!/[A-Za-z].|.[A-Za-z]/i.test(blanked)
) {
return null;
}

const factAnswers = Array.isArray(candidates)
? candidates
.filter(item => typeof item === “string”)
.map(item => cleanText(item))
.filter(value =>
value.length >= 5 &&
value.length <= 120 &&
value.split(/\s+/).length >= 2 &&
value.split(/\s+/).length <= 18 &&
!/^(because|although|however|therefore|other)\b/i.test(value) &&
normalize(value) !== normalize(answer)
)
: [];

const uniqueAnswers = uniqueCandidates(factAnswers);

if (uniqueAnswers.length < 3) {
return null;
}

const options = makeOptions(answer, uniqueAnswers);

if (!options || options.length !== 4) {
return null;
}

const correctOptions = options.filter(
option => option.isCorrect === true
);

if (
correctOptions.length !== 1 ||
normalize(correctOptions[0].text) !== normalize(answer)
) {
return null;
}

return {
questionType: “recall”,
question: Complete the statement: ${blanked},
options,
answer,
explanation: The supplied notes state: ${cleanSentence},
source: “provided_notes”
};
}
function getDifficultyOrder(facts, difficulty) {
  const definitions = facts.filter(
    fact => fact.type === "definition"
  );

  const functions = facts.filter(
    fact => fact.type === "function"
  );

  const purposes = facts.filter(
    fact => fact.type === "purpose"
  );

  if (difficulty === "easy") {
    return [
      ...definitions,
      ...purposes,
      ...functions
    ];
  }

  if (difficulty === "hard") {
    return [
      ...functions,
      ...purposes,
      ...definitions
    ];
  }

  return [
    ...purposes,
    ...definitions,
    ...functions
  ];
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
    throw new Error(
      "Difficulty must be easy, medium, or hard."
    );
  }

  const cleanTopic =
    cleanText(topic) || "General Studies";

  const sentences = splitSentences(notes);

  const facts = sentences
.map(extractFact)
.filter(Boolean)
.filter(fact =>
isUsableEntity(fact.entity) &&
isUsableAnswer(fact.answer)
);
  const candidates = getAnswerCandidates(notes, facts);

  const questions = [];
  const seenQuestions = new Set();
  const seenAnswers = new Set();

  // Prioritize complete fact-based questions.
  const orderedFacts = shuffle(
    getDifficultyOrder(facts, difficulty)
  );

  for (const fact of orderedFacts) {
    if (questions.length >= count) {
      break;
    }

    const answerKey = normalize(fact.answer);

    if (seenAnswers.has(answerKey)) {
      continue;
    }

    const question = makeDirectQuestion(
      fact,
      facts,
      candidates
    );

    if (!question) {
      continue;
    }

    const questionKey = normalize(question.question);

    if (seenQuestions.has(questionKey)) {
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

  // Use recall questions only when the notes do not provide
  // enough suitable structured facts.
  for (const sentence of shuffle(sentences)) {
    if (questions.length >= count) {
      break;
    }

    const question = makeClozeQuestion(
      sentence,
      candidates
    );

    if (!question) {
      continue;
    }

    const questionKey = normalize(question.question);
    const answerKey = normalize(question.answer);

    if (
      seenQuestions.has(questionKey) ||
      seenAnswers.has(answerKey)
    ) {
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
    engine: "devtools-rule-based-mcq-v2.0",
    topic: cleanTopic,
    difficulty,
    requestedCount: count,
    generatedCount: questions.length,
    questions,
    message: questions.length === count
      ? "Questions generated from the supplied notes. Review the questions, options, and answers before examination use."
      : questions.length > 0
        ? `Generated ${questions.length} of ${count} requested questions. More detailed notes may be needed for additional suitable questions.`
        : "No suitable questions could be generated. Provide clearer, more detailed study notes."
  };
}

module.exports = {
  generateMCQs
};
