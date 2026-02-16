import * as cheerio from "cheerio";

function idf_w(word, documents) {
  const numDocsWithTerm = documents.filter((doc) =>
    doc.split(/\s+/).includes(word)
  ).length;
  
  return Math.max( 0, Math.log2(documents.length / (1 + numDocsWithTerm)) );
}

function tf_w_d(word, document) {
  const wordCount = (document).split(/\s+/).filter((w) => w === word).length;
  const totalWords = (document).split(/\s+/).length;
  return wordCount / totalWords;
}

function tfidf_w_d(word, document, documents) {
  const tf = tf_w_d(word, document);
  const idf = idf_w(word, documents);
  return Math.log2(1+tf) * idf;
}

function v_d(document, documents, query) {
  let vec = [];

  const uniqueQuery = Array.from(new Set(query.split(/\s+/))).join(" ");
  for (const term of uniqueQuery.split(/\s+/)) {
    vec.push(tfidf_w_d(term, document, documents));
  }

  let magnitude = Math.sqrt(vec.reduce((sum, val) => sum + (val * val), 0));
  
  return {vec, magnitude};
}

export function v_q(query, documents) {
  return v_d(query, documents, query);
}

export function cosineResult(query, doc, docs, { q_vec, q_magnitude }) {
  const { vec: d_vec, magnitude: d_magnitude } = v_d(pContent(doc.content), docs.map(d => pContent(d.content)), query);

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

function pContent(html) {
  const $ = cheerio.load(html);

  const paragraphs = [];
  $("p").each((i, el) => {
    paragraphs.push($(el).text().trim());
  });

  return paragraphs.join(" ");
}