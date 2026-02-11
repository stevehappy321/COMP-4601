export function idf_w(word, documents) {
  const totalNumDocs = documents.length;
  const numDocsWithTerm = documents.filter((doc) =>
    doc.split(/\s+/).includes(word)
  ).length;
  return Math.log(totalNumDocs / (1 + numDocsWithTerm));
}

export function tf_w_d(word, document) {
  const wordCount = document.split(/\s+/).filter((w) => w === word).length;
  const totalWords = document.split(/\s+/).length;
  return wordCount / totalWords;
}

export function tfidf_w_d(word, document, documents) {
  const tf = tf_w_d(word, document);
  const idf = idf_w(word, documents);
  return Math.log(1+tf) * idf;
}