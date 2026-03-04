// db.js
import { MongoClient } from "mongodb";

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB || "comp4601_lab3";

export async function connectDb() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();

  // MongoDB creates the DB automatically on first write
  const db = client.db(DB_NAME);

  // Explicitly create collection if it doesn't exist
  const collections = await db.listCollections({ name: "pages" }).toArray();
  if (collections.length === 0) {
    await db.createCollection("pages");
  }

  const pages = db.collection("pages");

  // Required indexes
  await pages.createIndex(
    { dataset: 1, origUrl: 1 },
    { unique: true }
  );

  await pages.createIndex(
    { dataset: 1, incomingCount: -1 }
  );

  console.log(`Connected to MongoDB database: ${DB_NAME}`);

  return { client, db, pages };
}
