// datasets.js
export const DATASETS = {
  tinyfruits: "https://people.scs.carleton.ca/~avamckenney/tinyfruits/N-0.html",
  fruits100: "https://people.scs.carleton.ca/~avamckenney/fruits100/N-0.html",
  fruitsA: "https://people.scs.carleton.ca/~avamckenney/fruitsA/N-0.html",
};

// Allowed crawl prefixes PER dataset
export const ALLOWED_PREFIXES = {
  tinyfruits: ["https://people.scs.carleton.ca/~avamckenney/tinyfruits/"],
  fruits100: ["https://people.scs.carleton.ca/~avamckenney/fruits100/"],
  //IMPORTANT: fruitsA must include fruitsB too (per expected results)
  fruitsA: [
    "https://people.scs.carleton.ca/~avamckenney/fruitsA/",
    "https://people.scs.carleton.ca/~avamckenney/fruitsB/",
  ],
};
