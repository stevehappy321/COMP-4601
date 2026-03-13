// server.js
import express from "express";
import { MongoClient } from "mongodb";
import { pContent, extractTitle, calculateWordFrequency } from "./utils.js";
import { precomputePageRanks } from "./pagerank.js";
import { performance } from "perf_hooks";
import { CosineCompute } from "./CosineCompute.js";

const app = express();
app.use(express.json());

// Serve static files from public directory
app.use(express.static("public"));

// --- Config ---
const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB || "comp4601_lab3";
const COLLECTION_PAGES = "pages";

// Your registration info
const SERVER_NAME = "FlambardGreenhill8260";

// Datasets to compute PageRank for
const DATASETS = ["tinyfruits", "fruits100", "fruitsA", "personal"];

let client;
let pages;

// Cache for pre-computed search indexes per dataset
// Map(datasetName -> { N, docs: [...], df: Map, postings: Map })
const documentCache = new Map();

// Cache for pre-computed PageRank values
// Map of dataset -> Map(URL -> PageRank)
let pageRankCache = new Map();

// ----------------- Helpers -----------------

// Keep the exact same tokenization behavior you already had (whitespace split)
function normalizeText(text) {
  return (text || "").toLowerCase().split(/\s+/).filter((w) => w.length > 0);
}

function baseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

function idfFromDf(df, N) {
  // Same formula you used before: log2(N / (1 + df)), clamped at >= 0
  if (!df || df <= 0) return 0;
  return Math.max(0, Math.log2(N / (1 + df)));
}

function makeTermCounts(tokens) {
  const tf = new Map();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) || 0) + 1);
  }
  return tf;
}

// Build and cache an inverted index for a dataset
async function getDatasetIndex(datasetName) {
  if (documentCache.has(datasetName)) {
    return documentCache.get(datasetName);
  }

  console.log(`Loading & indexing documents for dataset: ${datasetName}`);
  const t0 = performance.now();

  // Fetch all documents for this dataset
  const rawDocs = await pages.find({ dataset: datasetName }).toArray();

  const df = new Map();        // term -> document frequency
  const postings = new Map();  // term -> [docIndex,...]

  // Store only what search needs (saves RAM)
  const docs = rawDocs.map((doc) => {
    const paragraphContent = pContent(doc.content);
    const tokens = normalizeText(paragraphContent);
    const tf = makeTermCounts(tokens);
    const totalWords = tokens.length;

    // Update df/postings using unique terms in this doc
    const seen = new Set(tf.keys());
    // We'll fill docIndex after we know it, so use a placeholder and patch below
    return {
      origUrl: doc.origUrl,
      content: doc.content, // kept only because you return title in search + /page uses it; remove if you don't need it in search
      title: extractTitle(doc.content),
      paragraphContent, // optional: keep for debugging; not used in scoring
      tf,
      totalWords,
      mag: 0, // TF-IDF magnitude (filled after df computed)
    };
  });

  // Build df + postings (needs doc indexes)
  for (let i = 0; i < docs.length; i++) {
    for (const term of docs[i].tf.keys()) {
      df.set(term, (df.get(term) || 0) + 1);
      if (!postings.has(term)) postings.set(term, []);
      postings.get(term).push(i);
    }
  }

  const N = docs.length;

  // Precompute per-doc TF-IDF magnitude once:
  // mag = sqrt(sum_over_terms( (log2(1+tf) * idf)^2 ))
  for (let i = 0; i < docs.length; i++) {
    let sumSq = 0;
    for (const [term, count] of docs[i].tf.entries()) {
      const idf = idfFromDf(df.get(term), N);
      if (idf === 0) continue;
      const w = CosineCompute.tfidf(count, docs[i].totalWords, df.get(term), N)
      sumSq += w * w;
    }
    docs[i].mag = Math.sqrt(sumSq);
  }

  const index = { N, docs, df, postings };
  documentCache.set(datasetName, index);

  const t1 = performance.now();
  console.log(`Indexed ${N} documents for ${datasetName} in ${Math.round(t1 - t0)}ms`);

  return index;
}


import { createProxyMiddleware } from 'http-proxy-middleware';

app.use("/recommendations", createProxyMiddleware({
  target: "http://localhost:3001",
  changeOrigin: true,
  pathRewrite: (path) => `/recommendations${path}`,
}));

app.use("/test", createProxyMiddleware({
  target: "http://localhost:3001",
  changeOrigin: true,
  pathRewrite: (path) => `/test${path}`,
}));




// ---------------- INFO (required by grading server) ----------------
app.get("/info", (req, res) => {
  res.json({
    name: SERVER_NAME,
  });
});

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
    return res.type("text/plain").send(pageRank.toString());
  } catch (err) {
    console.error("GET /pageranks error:", err);
    return res.status(500).send("Internal server error");
  }
});

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
      { projection: { _id: 0, origUrl: 1, incoming: 1, outgoing: 1, content: 1 } }
    );

    if (!doc) {
      return res.status(404).json({ error: "Not found" });
    }

    const pageRank = pageRankCache.get(dataset)?.get(webUrl) || 0;

    return res.json({
      url: doc.origUrl,
      title: extractTitle(doc.content),
      pageRank: pageRank,
      incomingLinks: Array.isArray(doc.incoming) ? doc.incoming : [],
      outgoingLinks: Array.isArray(doc.outgoing) ? doc.outgoing : [],
      wordFrequency: calculateWordFrequency(doc.content),
    });
  } catch (err) {
    console.error("GET /:dataset/page error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/favicon.ico", (req, res) => {
  res.status(204).end(); // No Content
});

// ---------------- SEARCH (A1) ----------------
app.get("/:datasetName", async (req, res) => {
  try {
    const { datasetName } = req.params;
    const q = req.query.q;
    const boost = req.query.boost === "true";
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);

    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Missing query parameter: q" });
    }

    const t0 = performance.now();

    const index = await getDatasetIndex(datasetName);
    const { docs, df, postings, N } = index;

    if (!docs || docs.length === 0) {
      return res.status(404).json({ error: "Dataset not found", result: [] });
    }

    // Build query term counts once
    const queryTokens = normalizeText(q);
    const qTf = makeTermCounts(queryTokens);
    const qTotal = queryTokens.length;

    // Keep only terms that appear in at least one document (df > 0)
    const validTerms = [];
    for (const term of qTf.keys()) {
      if ((df.get(term) || 0) > 0) validTerms.push(term);
    }

    if (validTerms.length === 0) {
      // A1 requirement: still return 'limit' results even if nothing matches
      const emptyResults = docs.slice(0, limit).map((doc) => ({
        url: doc.origUrl,
        score: 0,
        title: doc.title,
        pr: pageRankCache.get(datasetName)?.get(doc.origUrl) || 0,
      }));
      return res.status(200).json({ result: emptyResults });
    }

    // Query weights + magnitude
    const qWeight = new Map();
    let qSumSq = 0;
    for (const term of validTerms) {
      const w = CosineCompute.tfidf(qTf.get(term), qTotal, df.get(term), N)
      if (w !== 0) {
        qWeight.set(term, w);
        qSumSq += w * w;
      }
    }
    const qMag = Math.sqrt(qSumSq);

    // Candidate documents: union of postings lists for valid terms
    const candidateSet = new Set();
    for (const term of qWeight.keys()) {
      const plist = postings.get(term);
      if (!plist) continue;
      for (const idx of plist) candidateSet.add(idx);
    }

    // Score candidates only
    const results = [];
    for (const idx of candidateSet) {
      const doc = docs[idx];

      {
        const pr = pageRankCache.get(datasetName)?.get(doc.origUrl) || 0;
        let cosine = CosineCompute.cosineScore([...qWeight.keys()], doc, df, [...qWeight.values()], qMag, N);
        if (boost) {
          cosine = cosine * (1 + pr * 10);
        }
        
        results.push({
          url: doc.origUrl,
          score: cosine,
          title: doc.title,
          pr: pr,
        });
      }
    }

    // If we have fewer than limit, pad with 0-score docs (matches prior behavior)
    if (results.length < limit) {
      const already = new Set(results.map((r) => r.url));
      for (const doc of docs) {
        if (results.length >= limit) break;
        if (already.has(doc.origUrl)) continue;
        results.push({
          url: doc.origUrl,
          score: 0,
          title: doc.title,
          pr: pageRankCache.get(datasetName)?.get(doc.origUrl) || 0,
        });
      }
    }

    // Sort and limit
    results.sort((a, b) => b.score - a.score);
    const limitedResults = results.slice(0, limit);

    const t1 = performance.now();
    // Uncomment if you want per-request timing output:
    // console.log(`Search ${datasetName} q="${q}" -> ${Math.round(t1 - t0)}ms (candidates=${candidateSet.size}, N=${N})`);

    return res.status(200).json({ result: limitedResults });
  } catch (err) {
    console.error("GET /:datasetName error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});



// --- Startup ---
async function start() {
  client = new MongoClient(MONGO_URL);
  await client.connect();

  const db = client.db(DB_NAME);
  pages = db.collection(COLLECTION_PAGES);

  console.log(`Connected to MongoDB database: ${DB_NAME}`);

  // Helpful DB indexes (speeds /page and initial loads)
  try {
    await pages.createIndex({ dataset: 1 });
    await pages.createIndex({ dataset: 1, origUrl: 1 }, { unique: true });
  } catch (e) {
    // ignore index create errors (e.g., duplicates in an existing db)
    console.warn("Index creation warning:", e?.message || e);
  }

  // Pre-compute PageRank values for all datasets
  console.log("Pre-computing PageRank values...");
  pageRankCache = await precomputePageRanks(pages, DATASETS);
  console.log("PageRank pre-computation complete!");

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
});
