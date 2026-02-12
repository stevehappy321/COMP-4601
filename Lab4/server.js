// server.js
import express from "express";
import { MongoClient } from "mongodb";
import { idf_w, tf_w_d, tfidf_w_d, buildQueryVector, computeCosine } from "./compute.js";

const app = express();
app.use(express.json());

// --- Config ---
const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB || "comp4601_lab3";
const COLLECTION = "pages";

// Your registration info
const SERVER_NAME = "FlambardGreenhill8260";

let client;
let pages;

function baseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

// ---------------- INFO (required by grading server) ----------------
app.get("/info", (req, res) => {
  res.json({
    name: SERVER_NAME,
  });
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

app.get("/:datasetName", async (req, res) => {
  const { datasetName } = req.params;
  const q = req.query.q;

  const docs = await pages.find({ dataset: datasetName }).toArray();
  const docsContents = docs.map(d => d.content);

  const queryData = buildQueryVector(q, docsContents);
  console.log("Query vector:", queryData.vector);

  const results = [];

  for (const doc of docs) {
    results.push(
      computeCosine(doc, queryData, docsContents)
    );
  }

  results.sort((a, b) => b.score - a.score);

  res.status(200).json({ results });
})



// --- Startup ---
async function start() {
  client = new MongoClient(MONGO_URL);
  await client.connect();

  const db = client.db(DB_NAME);
  pages = db.collection(COLLECTION);

  console.log(`Connected to MongoDB database: ${DB_NAME}`);
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


