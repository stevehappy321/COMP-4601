// server.js
import express from "express";
import { MongoClient } from "mongodb";
<<<<<<< Updated upstream
import { cosineResult, v_q } from "./compute.js";
=======
import { cosineResult, v_q, pContent } from "./compute.js";
import { precomputePageRanks } from "./pagerank.js";
>>>>>>> Stashed changes

const app = express();
app.use(express.json());

// --- Config ---
const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB || "comp4601_lab3";
const COLLECTION_PAGES = "pages";

// Your registration info
const SERVER_NAME = "FlambardGreenhill8260";

<<<<<<< Updated upstream
let client;
let pages;

=======
// Datasets to compute PageRank for
const DATASETS = ["tinyfruits", "fruits100", "fruitsA"];

let client;
let pages;

// Cache for pre-computed document content
const documentCache = new Map();

// Cache for pre-computed PageRank values
// Map of dataset -> Map(URL -> PageRank)
let pageRankCache = new Map();

// Inline helper functions for speed
function normalizeText(text) {
  return text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
}

function tf_w_d(word, docText, docsContent) {
  const words = normalizeText(docText);
  const wordCount = words.filter((w) => w === word).length;
  const totalWords = words.length;
  
  if (totalWords === 0) return 0;
  return wordCount / totalWords;
}

function idf_w_fast(word, docs) {
  // Use pre-computed normalized words
  const numDocsWithTerm = docs.filter(doc => doc.normalizedWords.includes(word)).length;

  if (numDocsWithTerm === 0) {
    return 0;
  }
  
  return Math.max(0, Math.log2(docs.length / (1 + numDocsWithTerm)));
}

>>>>>>> Stashed changes
function baseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

<<<<<<< Updated upstream
=======
// Pre-compute and cache document content for a dataset
async function getDatasetDocuments(datasetName) {
  // Check cache first
  if (documentCache.has(datasetName)) {
    return documentCache.get(datasetName);
  }

  console.log(`Loading and caching documents for dataset: ${datasetName}`);
  const startTime = Date.now();
  
  // Fetch all documents for this dataset
  const docs = await pages.find({ dataset: datasetName }).toArray();
  
  // Pre-extract paragraph content and normalize
  const docsWithContent = docs.map(doc => {
    const paragraphContent = pContent(doc.content);
    return {
      ...doc,
      paragraphContent,
      normalizedWords: normalizeText(paragraphContent) // Pre-compute for speed
    };
  });
  
  // Cache the result
  documentCache.set(datasetName, docsWithContent);
  
  const elapsed = Date.now() - startTime;
  console.log(`Cached ${docsWithContent.length} documents for ${datasetName} in ${elapsed}ms`);
  return docsWithContent;
}

>>>>>>> Stashed changes
// ---------------- INFO (required by grading server) ----------------
app.get("/info", (req, res) => {
  res.json({
    name: SERVER_NAME,
  });
});

<<<<<<< Updated upstream
=======
// ---------------- PAGERANKS (Lab 5) ----------------
app.get("/pageranks", (req, res) => {
  try {
    const url = req.query.url;

    if (!url || typeof url !== "string") {
      return res.status(400).send("Missing query parameter: url");
    }

    // Determine which dataset this URL belongs to
    let dataset = null;
    for (const ds of DATASETS) {
      const pageRanks = pageRankCache.get(ds);
      if (pageRanks && pageRanks.has(url)) {
        dataset = ds;
        break;
      }
    }

    if (!dataset) {
      return res.status(404).send("URL not found in any dataset");
    }

    const pageRank = pageRankCache.get(dataset).get(url);
    
    // Return plain text representation of PageRank value
    return res.type('text/plain').send(pageRank.toString());
  } catch (err) {
    console.error("GET /pageranks error:", err);
    return res.status(500).send("Internal server error");
  }
});

>>>>>>> Stashed changes

app.get("/:dataset/popular", async (req, res) => {
  try {
    const { dataset } = req.params;

    // Compute popularity from true in-degree (incoming array length)
    const docs = await pages
      .aggregate([
        { $match: { dataset } },
        {
          $addFields: {
            inDegree: { $size: { $ifNull: ["$incoming", []] } },
          },
        },
        { $sort: { inDegree: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, origUrl: 1 } },
      ])
      .toArray();

    const result = docs.map((d) => ({
      url: `${baseUrl(req)}/${dataset}/page?webUrl=${encodeURIComponent(d.origUrl)}`,
      origUrl: d.origUrl,
    }));

    return res.json({ result });
  } catch (err) {
    console.error("GET /:dataset/popular error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/:dataset/page", async (req, res) => {
  try {
    const { dataset } = req.params;
    const webUrl = req.query.webUrl;

    if (!webUrl || typeof webUrl !== "string") {
      return res.status(400).json({ error: "Missing query parameter: webUrl" });
    }

    const doc = await pages.findOne(
      { dataset, origUrl: webUrl },
      { projection: { _id: 0, origUrl: 1, incoming: 1 } }
    );

    if (!doc) {
      return res.status(404).json({ error: "Not found" });
    }

    return res.json({
      webUrl: doc.origUrl,
      incomingLinks: Array.isArray(doc.incoming) ? doc.incoming : [],
    });
  } catch (err) {
    console.error("GET /:dataset/page error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/favicon.ico", (req, res) => {
  res.status(204).end(); // No Content
});

app.get("/:datasetName", async (req, res) => {
<<<<<<< Updated upstream
  const { datasetName } = req.params;
  const q = req.query.q;

  const docs = await pages.find({ dataset: datasetName }).toArray();

  const result = [];

  const { vec: q_vec, magnitude: q_magnitude } = v_q(q, docs.map(d => d.content));

  for (const doc of docs) {
    result.push(
      cosineResult(q, doc, docs, {q_vec, q_magnitude})
    );
  }

  result.sort((a, b) => b.score - a.score);

  const top10 = result.slice(0, 10);

  res.status(200).json({ result: top10 });
})
=======
  try {
    const { datasetName } = req.params;
    const q = req.query.q;

    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Missing query parameter: q" });
    }

    // Get cached documents (or load and cache them)
    const docs = await getDatasetDocuments(datasetName);

    if (docs.length === 0) {
      return res.status(404).json({ error: "Dataset not found", result: [] });
    }

    // Compute query vector inline (optimized)
    const queryWords = normalizeText(q);
    const uniqueQueryTerms = [...new Set(queryWords)];
    
    // Filter to only terms that appear in at least one document (using pre-computed words)
    const validTerms = uniqueQueryTerms.filter(term => {
      return docs.some(doc => doc.normalizedWords.includes(term));
    });
    
    if (validTerms.length === 0) {
      return res.status(200).json({ result: [] });
    }
    
    // Build query vector
    const q_vec = [];
    const docsContent = docs.map(d => d.paragraphContent);
    
    for (const term of validTerms) {
      const tf = tf_w_d(term, q, docsContent);
      const idf = idf_w_fast(term, docs);
      q_vec.push(Math.log2(1 + tf) * idf);
    }
    
    const q_magnitude = Math.sqrt(q_vec.reduce((sum, val) => sum + (val * val), 0));

    // Compute cosine similarity for each document
    const result = [];
    for (const doc of docs) {
      // Build document vector for this specific query's valid terms
      const d_vec = [];
      for (const term of validTerms) {
        const tf = tf_w_d(term, doc.paragraphContent, docsContent);
        const idf = idf_w_fast(term, docs);
        d_vec.push(Math.log2(1 + tf) * idf);
      }
      
      const d_magnitude = Math.sqrt(d_vec.reduce((sum, val) => sum + (val * val), 0));
      const dot = q_vec.reduce((sum, val, i) => sum + val * d_vec[i], 0);
      const scalar = q_magnitude * d_magnitude;
      const cosine = scalar === 0 ? 0 : dot / scalar;

      result.push({
        url: doc.origUrl,
        score: cosine,
      });
    }

    // Sort by score descending and take top 10
    result.sort((a, b) => b.score - a.score);
    const top10 = result.slice(0, 10);

    res.status(200).json({ result: top10 });
  } catch (err) {
    console.error("GET /:datasetName error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
>>>>>>> Stashed changes




// --- Startup ---
async function start() {
  client = new MongoClient(MONGO_URL);
  await client.connect();

  const db = client.db(DB_NAME);
  pages = db.collection(COLLECTION_PAGES);

  console.log(`Connected to MongoDB database: ${DB_NAME}`);
<<<<<<< Updated upstream
=======
  
  // Pre-compute PageRank values for all datasets
  console.log("Pre-computing PageRank values...");
  pageRankCache = await precomputePageRanks(pages, DATASETS);
  console.log("PageRank pre-computation complete!");
  
>>>>>>> Stashed changes
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

process.on("SIGINT", async () => {
  try {
    if (client) await client.close();
  } finally {
    process.exit(0);
  }
});

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
<<<<<<< Updated upstream
});


=======
});
>>>>>>> Stashed changes
