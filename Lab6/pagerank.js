// pagerank.js
// PageRank implementation for Lab 5

/**
 * Calculate PageRank for all pages in a dataset
 * 
 * PR(p) = (α/N) + (1-α) × Σ(PR(q) / OutDegree(q))
 * 
 * @param {Array} docs - Array of document objects with origUrl, incoming, and outgoing arrays
 * @param {number} alpha - Damping factor (default 0.1)
 * @param {number} epsilon - Convergence threshold (default 0.0001)
 * @returns {Map} Map of URL -> PageRank value
 */
export function calculatePageRank(docs, alpha = 0.1, epsilon = 0.0001) {
  const n = docs.length;

  console.log("----- PageRank Calculation Starting -----");
  console.log(`Total pages: ${n}`);
  console.log(`Alpha (damping factor): ${alpha}`);
  console.log(`Epsilon (convergence threshold): ${epsilon}`);

  if (n === 0) {
    console.log("No documents provided. Returning empty PageRank map.");
    return new Map();
  }

  // Create URL to index mapping
  const urlToIndex = new Map();
  const indexToUrl = new Map();

  docs.forEach((doc, i) => {
    urlToIndex.set(doc.origUrl, i);
    indexToUrl.set(i, doc.origUrl);
  });

  console.log("URL mapping created.");

  // Build adjacency information
  const outgoingCount = new Array(n).fill(0);

  docs.forEach((doc, i) => {
    if (doc.outgoing && Array.isArray(doc.outgoing)) {
      outgoingCount[i] = doc.outgoing.length;
    }
  });

  console.log("Outgoing link counts:");
  // docs.forEach((doc, i) => {
  //   console.log(`  ${doc.origUrl} -> ${outgoingCount[i]} outgoing links`);
  // });

  // Initialize PageRank values
  let pr = new Array(n).fill(1.0 / n);
  let pr_next = new Array(n).fill(0);

  console.log("Initial PageRank values:");
  // docs.forEach((doc, i) => {
  //   console.log(`  ${doc.origUrl}: ${pr[i]}`);
  // });

  let iterations = 0;
  const maxIterations = 1000;

  while (iterations < maxIterations) {
    // console.log(`\n--- Iteration ${iterations + 1} ---`);

    for (let i = 0; i < n; i++) {
      let sum = 0;
      const currentUrl = docs[i].origUrl;

      // console.log(`Calculating PR for: ${currentUrl}`);

      for (let j = 0; j < n; j++) {
        const sourceDoc = docs[j];

        if (sourceDoc.outgoing && Array.isArray(sourceDoc.outgoing)) {
          if (sourceDoc.outgoing.includes(currentUrl)) {
            const outCount = outgoingCount[j];

            if (outCount > 0) {
              const contribution = pr[j] / outCount;
              sum += contribution;

              // console.log(
              //   `  Link from ${sourceDoc.origUrl} contributes ${contribution}`
              // );
            }
          }
        }
      }

      pr_next[i] = alpha / n + (1 - alpha) * sum;

      // console.log(
      //   `  New PR(${currentUrl}) = ${pr_next[i]} (sum=${sum})`
      // );
    }

    // Calculate Euclidean distance
    let distance = 0;

    for (let i = 0; i < n; i++) {
      const diff = pr_next[i] - pr[i];
      distance += diff * diff;
    }

    distance = Math.sqrt(distance);

    console.log(`Iteration ${iterations + 1} distance: ${distance}`);

    // Check convergence
    if (distance < epsilon) {
      console.log(
        `PageRank converged after ${iterations + 1} iterations (distance: ${distance})`
      );
      pr = pr_next;
      break;
    }

    // Snapshot every 5 iterations
    // if ((iterations + 1) % 5 === 0) {
      // console.log(`PageRank snapshot at iteration ${iterations + 1}:`);
      // docs.forEach((doc, i) => {
      //   console.log(`  ${doc.origUrl}: ${pr_next[i]}`);
      // });
    // }

    pr = pr_next;
    pr_next = new Array(n).fill(0);
    iterations++;
  }

  if (iterations >= maxIterations) {
    console.warn(`PageRank did not converge after ${maxIterations} iterations`);
  }

  console.log("Final PageRank values:");

  const pageRankMap = new Map();

  for (let i = 0; i < n; i++) {
    const url = indexToUrl.get(i);
    const rank = pr[i];
    console.log(`  ${url}: ${rank}`);
    pageRankMap.set(url, rank);
  }

  console.log("----- PageRank Calculation Complete -----");

  return pageRankMap;
}

/**
 * Pre-compute PageRank for all datasets and store in cache
 * @param {Collection} pagesCollection - MongoDB pages collection
 * @param {Array} datasetNames - Array of dataset names to compute PageRank for
 * @returns {Map} Map of dataset -> Map(URL -> PageRank)
 */
export async function precomputePageRanks(pagesCollection, datasetNames) {
  const pageRankCache = new Map();
  
  for (const datasetName of datasetNames) {
    console.log(`Computing PageRank for dataset: ${datasetName}`);
    const startTime = Date.now();
    
    // Fetch all documents for this dataset
    const docs = await pagesCollection
      .find({ dataset: datasetName })
      .toArray();
    
    if (docs.length === 0) {
      console.warn(`No documents found for dataset: ${datasetName}`);
      continue;
    }
    
    // Calculate PageRank
    const pageRanks = calculatePageRank(docs);
    pageRankCache.set(datasetName, pageRanks);
    
    const elapsed = Date.now() - startTime;
    console.log(`PageRank computed for ${datasetName}: ${docs.length} pages in ${elapsed}ms`);
    
    // Log top 5 pages by PageRank
    const sorted = Array.from(pageRanks.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    console.log(`Top 5 pages in ${datasetName}:`);
    sorted.forEach(([url, pr], i) => {
      console.log(`  ${i + 1}. ${url}: ${pr}`);
    });
  }
  
  return pageRankCache;
}