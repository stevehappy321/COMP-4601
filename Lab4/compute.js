export function idf_w(word, documents) {
  const numDocsWithTerm = documents.filter((doc) =>
    doc.split(/\s+/).includes(word)
  ).length;
  
  return Math.max( 0, Math.log2(documents.length / (1 + numDocsWithTerm)) );
}

export function tf_w_d(word, document) {
  const wordCount = document.split(/\s+/).filter((w) => w === word).length;
  const totalWords = document.split(/\s+/).length;
  return wordCount / totalWords;
}

export function tfidf_w_d(word, document, documents) {
  const tf = tf_w_d(word, document);
  const idf = idf_w(word, documents);
  return Math.log2(1+tf) * idf;
}

export function buildQueryVector(query, documents) {
  const terms = query.trim().split(/\s+/);
  const vector = {};

  for (const word of terms) {
    vector[word] = tfidf_w_d(word, query, documents);
  }

  const magnitude = Math.sqrt(
    Object.values(vector).reduce((sum, v) => sum + v * v, 0)
  );

  return { vector, magnitude, terms };
}

function mag_d(doc, documents) {
  const words = doc.content.trim().split(/\s+/);
  const uniqueWords = [...new Set(words)];

  let sum = 0;

  for (const word of uniqueWords) {
    const tfidf = tfidf_w_d(word, doc.content, documents);
    sum += tfidf * tfidf;
  }

  return Math.sqrt(sum);
}

export function computeCosine(doc, queryData, documents) {
  const { vector: queryVector, magnitude: queryMagnitude, terms } = queryData;

  const docVector = {};
  let dotProduct = 0;

  for (const word of terms) {
    const tfidf = tfidf_w_d(word, doc.content, documents);
    docVector[word] = tfidf;
    dotProduct += tfidf * (queryVector[word] || 0);
  }

  const docMagnitude = mag_d(doc, documents);

  const cosine =
    queryMagnitude === 0 || docMagnitude === 0
      ? 0
      : dotProduct / (queryMagnitude * docMagnitude);

  return {
    url: doc.origUrl,
    score: cosine,
    points: docVector
  };
}