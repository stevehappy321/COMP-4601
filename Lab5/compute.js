import * as cheerio from "cheerio";

<<<<<<< Updated upstream
function idf_w(word, documents) {
  const numDocsWithTerm = documents.filter((doc) =>
    doc.split(/\s+/).includes(word)
  ).length;
=======
// Normalize text: lowercase and tokenize
function normalizeText(text) {
  return text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
}

function idf_w(word, documents) {
  const numDocsWithTerm = documents.filter((doc) => {
    const words = normalizeText(doc);
    return words.includes(word);
  }).length;
>>>>>>> Stashed changes

  if (numDocsWithTerm === 0) {
    return 0;
  }
  
<<<<<<< Updated upstream
  return Math.max( 0, Math.log2(documents.length / (1 + numDocsWithTerm)) );
}

function tf_w_d(word, document) {
  const wordCount = (document).split(/\s+/).filter((w) => w === word).length;
  const totalWords = (document).split(/\s+/).length;
=======
  return Math.max(0, Math.log2(documents.length / (1 + numDocsWithTerm)));
}

function tf_w_d(word, document) {
  const words = normalizeText(document);
  const wordCount = words.filter((w) => w === word).length;
  const totalWords = words.length;
  
  if (totalWords === 0) return 0;
>>>>>>> Stashed changes
  return wordCount / totalWords;
}

function tfidf_w_d(word, document, documents) {
  const tf = tf_w_d(word, document);
  const idf = idf_w(word, documents);
<<<<<<< Updated upstream
  return Math.log2(1+tf) * idf;
=======
  return Math.log2(1 + tf) * idf;
>>>>>>> Stashed changes
}

function v_d(document, documents, query) {
  let vec = [];

<<<<<<< Updated upstream
  const uniqueQuery = Array.from(new Set(query.split(/\s+/))).join(" ");
  for (const term of uniqueQuery.split(/\s+/)) {
=======
  const queryWords = normalizeText(query);
  const uniqueQuery = [...new Set(queryWords)];
  
  for (const term of uniqueQuery) {
>>>>>>> Stashed changes
    vec.push(tfidf_w_d(term, document, documents));
  }

  let magnitude = Math.sqrt(vec.reduce((sum, val) => sum + (val * val), 0));
  
<<<<<<< Updated upstream
  return {vec, magnitude};
=======
  return { vec, magnitude };
>>>>>>> Stashed changes
}

export function v_q(query, documents) {
  return v_d(query, documents, query);
}

export function cosineResult(query, doc, docs, { q_vec, q_magnitude }) {
<<<<<<< Updated upstream
  const { vec: d_vec, magnitude: d_magnitude } = v_d(pContent(doc.content), docs.map(d => pContent(d.content)), query);
=======
  const docText = pContent(doc.content);
  const docsText = docs.map(d => pContent(d.content));
  
  const { vec: d_vec, magnitude: d_magnitude } = v_d(docText, docsText, query);
>>>>>>> Stashed changes

  const dot = dotProduct(q_vec, d_vec);
  const scalar = q_magnitude * d_magnitude;

  const cosine = scalar === 0 ? 0 : dot / scalar;

  return {
    url: doc.origUrl,
    score: cosine,
  };
}

function dotProduct(vector1, vector2) {
  if (vector1.length !== vector2.length) {
    throw new Error("Vectors must be of the same length to calculate the dot product.");
  }

  let result = 0;
  for (let i = 0; i < vector1.length; i++) {
    result += vector1[i] * vector2[i];
  }
  return result;
}

<<<<<<< Updated upstream
function pContent(html) {
=======
// Extract text from paragraph tags only
export function pContent(html) {
  if (!html) return "";
  
>>>>>>> Stashed changes
  const $ = cheerio.load(html);

  const paragraphs = [];
  $("p").each((i, el) => {
<<<<<<< Updated upstream
    paragraphs.push($(el).text().trim());
=======
    const text = $(el).text().trim();
    if (text) {
      paragraphs.push(text);
    }
>>>>>>> Stashed changes
  });

  return paragraphs.join(" ");
}