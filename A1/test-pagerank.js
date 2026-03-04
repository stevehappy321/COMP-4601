// test-pagerank.js
// Test PageRank calculations against expected values

import { MongoClient } from "mongodb";
import { calculatePageRank } from "./pagerank.js";

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB || "comp4601_lab3";

// Expected PageRank values from the lab spec
const EXPECTED_TINYFRUITS = {
  "https://people.scs.carleton.ca/~avamckenney/tinyfruits/N-0.html": 0.32242792521306995,
  "https://people.scs.carleton.ca/~avamckenney/tinyfruits/N-8.html": 0.12476521976591842,
  "https://people.scs.carleton.ca/~avamckenney/tinyfruits/N-7.html": 0.11939323868209492,
  "https://people.scs.carleton.ca/~avamckenney/tinyfruits/N-4.html": 0.11896585666418055,
  "https://people.scs.carleton.ca/~avamckenney/tinyfruits/N-3.html": 0.0819555328928385,
  "https://people.scs.carleton.ca/~avamckenney/tinyfruits/N-9.html": 0.047437705789256435,
  "https://people.scs.carleton.ca/~avamckenney/tinyfruits/N-5.html": 0.04626363024816037,
  "https://people.scs.carleton.ca/~avamckenney/tinyfruits/N-6.html": 0.04626363024816037,
  "https://people.scs.carleton.ca/~avamckenney/tinyfruits/N-1.html": 0.04626363024816037,
  "https://people.scs.carleton.ca/~avamckenney/tinyfruits/N-2.html": 0.04626363024816037,
};

async function testPageRank() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();

  const db = client.db(DB_NAME);
  const pages = db.collection("pages");

  // Test tinyfruits dataset
  console.log("Testing tinyfruits dataset...\n");
  const docs = await pages.find({ dataset: "tinyfruits" }).toArray();
  
  console.log(`Found ${docs.length} documents`);
  
  const pageRanks = calculatePageRank(docs, 0.1, 0.0001);
  
  console.log("\nComparing with expected values:\n");
  
  let allMatch = true;
  for (const [url, expectedPR] of Object.entries(EXPECTED_TINYFRUITS)) {
    const calculatedPR = pageRanks.get(url);
    const diff = Math.abs(calculatedPR - expectedPR);
    const match = diff < 0.000001; // Allow small floating point differences
    
    if (!match) {
      allMatch = false;
      console.log(`❌ ${url}`);
      console.log(`   Expected:   ${expectedPR}`);
      console.log(`   Calculated: ${calculatedPR}`);
      console.log(`   Difference: ${diff}\n`);
    } else {
      console.log(`✓ ${url.split('/').pop()}: ${calculatedPR}`);
    }
  }
  
  if (allMatch) {
    console.log("\n✅ All PageRank values match expected results!");
  } else {
    console.log("\n❌ Some PageRank values don't match. Check implementation.");
  }
  
  // Show top 10 ranked pages
  console.log("\n\nTop 10 pages by PageRank:");
  const sorted = Array.from(pageRanks.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  sorted.forEach(([url, pr], i) => {
    console.log(`${i + 1}. ${url.split('/').pop()}: ${pr}`);
  });

  await client.close();
}

testPageRank().catch(console.error);