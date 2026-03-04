import * as cheerio from "cheerio";

// Normalize text: lowercase and tokenize
function normalizeText(text) {
  return text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
}

function idf_w(word, documents) {
  const numDocsWithTerm = documents.filter((doc) => {
    const words = normalizeText(doc);
    return words.includes(word);
  }).length;

  if (numDocsWithTerm === 0) {
    return 0;
  }
  
  return Math.max(0, Math.log2(documents.length / (1 + numDocsWithTerm)));
}

function tf_w_d(word, document) {
  const words = normalizeText(document);
  const wordCount = words.filter((w) => w === word).length;
  const totalWords = words.length;
  
  if (totalWords === 0) return 0;
  return wordCount / totalWords;
}

function tfidf_w_d(word, document, documents) {
  const tf = tf_w_d(word, document);
  const idf = idf_w(word, documents);
  return Math.log2(1 + tf) * idf;
}

function v_d(document, documents, query, validTerms) {
  let vec = [];
  
  for (const term of validTerms) {
    vec.push(tfidf_w_d(term, document, documents));
  }

  let magnitude = Math.sqrt(vec.reduce((sum, val) => sum + (val * val), 0));
  
  return { vec, magnitude };
}

export function v_q(query, documents) {
  // Get unique query terms
  const queryWords = normalizeText(query);
  const uniqueQueryTerms = [...new Set(queryWords)];
  
  // Filter to only terms that appear in at least one document
  const validTerms = uniqueQueryTerms.filter(term => {
    return documents.some(doc => {
      const docWords = normalizeText(doc);
      return docWords.includes(term);
    });
  });
  
  return { 
    ...v_d(query, documents, query, validTerms),
    validTerms 
  };
}

export function cosineResult(query, doc, docs, { q_vec, q_magnitude, validTerms }) {
  const docText = pContent(doc.content);
  const docsText = docs.map(d => pContent(d.content));
  
  const { vec: d_vec, magnitude: d_magnitude } = v_d(docText, docsText, query, validTerms);

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

// Extract text from paragraph tags only
export function pContent(html) {
  if (!html) return "";
  
  const $ = cheerio.load(html);

  const paragraphs = [];
  $("p").each((i, el) => {
    const text = $(el).text().trim();
    if (text) {
      paragraphs.push(text);
    }
  });

  return paragraphs.join(" ");
}

// Extract title from HTML
export function extractTitle(html) {
  if (!html) return "Untitled";
  
  const $ = cheerio.load(html);
  
  // Try <title> tag first
  const titleTag = $("title").first().text().trim();
  if (titleTag) return titleTag;
  
  // Try <h1> tag as fallback
  const h1Tag = $("h1").first().text().trim();
  if (h1Tag) return h1Tag;
  
  return "Untitled";
}

// Calculate word frequency from paragraph content
export function calculateWordFrequency(html) {
  const text = pContent(html);
  if (!text) return {};
  
  const words = text.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 0);
  
  const frequency = {};
  for (const word of words) {
    frequency[word] = (frequency[word] || 0) + 1;
  }
  
  // Return top 50 most frequent words
  return Object.fromEntries(
    Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
  );
}