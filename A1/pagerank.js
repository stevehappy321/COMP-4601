// pagerank.js
// PageRank implementation for Lab 5

/**
 * Calculate PageRank for all pages in a dataset
 * @param {Array} docs - Array of document objects with origUrl, incoming, and outgoing arrays
 * @param {number} alpha - Damping factor (default 0.1)
 * @param {number} epsilon - Convergence threshold (default 0.0001)
 * @returns {Map} Map of URL -> PageRank value
 */
export function calculatePageRank(docs, alpha = 0.1, epsilon = 0.0001) {
  const n = docs.length;
  
  if (n === 0) {
    return new Map();
  }

  // Create URL to index mapping
  const urlToIndex = new Map();
  const indexToUrl = new Map();
  
  docs.forEach((doc, i) => {
    urlToIndex.set(doc.origUrl, i);
    indexToUrl.set(i, doc.origUrl);
  });

  // Build adjacency information
  // outgoingCount[i] = number of outgoing links from page i
  const outgoingCount = new Array(n).fill(0);
  
  // For each page, get its outgoing links
  docs.forEach((doc, i) => {
    if (doc.outgoing && Array.isArray(doc.outgoing)) {
      outgoingCount[i] = doc.outgoing.length;
    }
  });

  // Initialize PageRank values uniformly
  let pr = new Array(n).fill(1.0 / n);
  let pr_next = new Array(n).fill(0);

  let iterations = 0;
  const maxIterations = 1000; // Safety limit

  while (iterations < maxIterations) {
    // Calculate new PageRank values
    for (let i = 0; i < n; i++) {
      let sum = 0;
      
      // Get all pages that link to page i
      const currentUrl = docs[i].origUrl;
      
      for (let j = 0; j < n; j++) {
        const sourceDoc = docs[j];
        
        // Check if page j links to page i
        if (sourceDoc.outgoing && Array.isArray(sourceDoc.outgoing)) {
          if (sourceDoc.outgoing.includes(currentUrl)) {
            // Page j links to page i
            const outCount = outgoingCount[j];
            if (outCount > 0) {
              sum += pr[j] / outCount;
            }
          }
        }
      }
      
      // PageRank formula: PR(i) = alpha/n + (1-alpha) * sum
      pr_next[i] = alpha / n + (1 - alpha) * sum;
    }

    // Calculate Euclidean distance between pr and pr_next
    let distance = 0;
    for (let i = 0; i < n; i++) {
      const diff = pr_next[i] - pr[i];
      distance += diff * diff;
    }
    distance = Math.sqrt(distance);

    // Check for convergence
    if (distance < epsilon) {
      console.log(`PageRank converged after ${iterations + 1} iterations (distance: ${distance})`);
      pr = pr_next;
      break;
    }

    // Update for next iteration
    pr = pr_next;
    pr_next = new Array(n).fill(0);
    iterations++;
  }

  if (iterations >= maxIterations) {
    console.warn(`PageRank did not converge after ${maxIterations} iterations`);
  }

  // Create result map
  const pageRankMap = new Map();
  for (let i = 0; i < n; i++) {
    pageRankMap.set(indexToUrl.get(i), pr[i]);
  }

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