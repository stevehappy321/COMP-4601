// server.js
import express from "express";
import { RecommendCompute } from './RecommendCompute.js';
import fs from 'fs'; 

const app = express();
app.use(express.json());

// Serve static files from public directory
app.use(express.static("public"));

// --- Config ---
const PORT = process.env.PORT || 3001;

// Your registration info
const SERVER_NAME = "FlambardGreenhill8260";

// ---------------- INFO (required by grading server) ----------------
app.get("/info", (req, res) => {
  res.json({
    name: SERVER_NAME,
  });
});

app.get('/recommendations/:datasetName', (req, res) => {
  const { type, user, item, k } = req.query;
  const { users, items, ratings } = loadDataset(req.params.datasetName);
  const result = type === 'item'
    ? RecommendCompute.predictRatingItem(ratings, users, user, item, k || 2)
    : RecommendCompute.predictRatingUser(ratings, users, user, item, k || 2);
  res.json(result);
});

app.get('/test', (req, res) => {
  res.json({ test: "ok" })
})

function loadDataset(dsName) {
  const text = fs.readFileSync("./ratings/" + dsName + ".txt", 'utf-8');
  const lines = text.trim().split('\n').map(l => l.trim());

  const [numUsers, numItems] = lines[0].split(' ').map(Number);
  const users = lines[1].split(' ');
  const items = lines[2].split(' ');

  const ratings = {};
  for (let u = 0; u < numUsers; u++) {
    ratings[users[u]] = {};
    const row = lines[3 + u].split(' ').map(Number);
    for (let i = 0; i < numItems; i++) {
      ratings[users[u]][items[i]] = row[i];
    }
  }

  return { users, items, ratings };
}




// --- Startup ---
async function start() {
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
