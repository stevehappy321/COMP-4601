// crawl.js
import Crawler from "crawler";
import * as cheerio from "cheerio";
import { URL } from "url";
import { connectDb } from "./db.js";
import { DATASETS, ALLOWED_PREFIXES } from "./datasets.js";

/**
 * Normalize links:
 * - resolve relative -> absolute
 * - drop hash fragments
 * - allow only URLs that match ANY of the allowedPrefixes
 */
function normalizeAndFilterLinks(currentUrl, rawHrefs, allowedPrefixes) {
  const out = new Set();

  for (const href of rawHrefs) {
    if (!href) continue;

    const h = String(href).trim();
    if (
      !h ||
      h.startsWith("mailto:") ||
      h.startsWith("javascript:") ||
      h.startsWith("tel:")
    )
      continue;

    let abs;
    try {
      abs = new URL(h, currentUrl);
    } catch {
      continue;
    }

    abs.hash = "";
    const absStr = abs.toString();

    // Allow only if it starts with ANY allowed prefix
    if (!allowedPrefixes.some((p) => absStr.startsWith(p))) continue;

    out.add(absStr);
  }

  return [...out];
}

function defaultDatasetRootFromSeed(seedUrl) {
  // e.g. https://.../tinyfruits/N-0.html -> https://.../tinyfruits/
  const u = new URL(seedUrl);
  const lastSlash = u.pathname.lastIndexOf("/");
  const dir = u.pathname.slice(0, lastSlash + 1);
  return `${u.origin}${dir}`;
}

async function crawlDataset({ pages, vocab, datasetName, seedUrl, maxPages = Infinity }) {
  // Use configured allowed prefixes if provided; otherwise fall back to the seed directory
  const allowedPrefixes =
    ALLOWED_PREFIXES?.[datasetName] ?? [defaultDatasetRootFromSeed(seedUrl)];

  const visited = new Set([seedUrl]);
  let processed = 0;

  let resolveDone;
  const donePromise = new Promise((res) => (resolveDone = res));

  const crawler = new Crawler({
    maxConnections: 8,
    jQuery: true,

    callback: async (err, res, done) => {
      try {
        const url =
          res?.options?.uri ||
          res?.options?.url ||
          res?.request?.uri?.href ||
          res?.request?.href;

        processed++;

        if (err) {
          console.error(`[${datasetName}] error fetching ${url}:`, err.message);
          return;
        }

        if (!url) {
          console.error(`[${datasetName}] URL undefined`);
          return;
        }

        // If the URL itself isn't allowed, skip processing (extra safety)
        if (!allowedPrefixes.some((p) => url.startsWith(p))) {
          return;
        }

        // console.log(`[${datasetName}] fetched: ${url}`);

        const $ = res.$ || cheerio.load(res.body?.toString?.() ?? "");
        const html = res.body?.toString?.() ?? "";

        const rawHrefs = $("a[href]")
          .map((_, a) => $(a).attr("href"))
          .get();

        const outgoing = normalizeAndFilterLinks(url, rawHrefs, allowedPrefixes);

        // console.log(
        //   `[${datasetName}] ${url} -> ${outgoing.length} outgoing links`
        // );

        // Store current page
        await pages.updateOne(
          { dataset: datasetName, origUrl: url },
          {
            $set: {
              dataset: datasetName,
              origUrl: url,
              content: html,
              outgoing,
              fetchedAt: new Date(),
            },
          },
          { upsert: true }
        );

        const bulkOps = html.trim().split(/\s+/).map(word => ({
          updateOne: {
            filter: { _id: word },
            update: { $inc: { count: 1 } },
            upsert: true
          }
        }) );

        await vocab.bulkWrite(bulkOps);
        

        // Update incoming edges for targets
        if (outgoing.length > 0) {
          const bulk = pages.initializeUnorderedBulkOp();

          for (const target of outgoing) {
            bulk
              .find({ dataset: datasetName, origUrl: target })
              .upsert()
              .updateOne({
                $setOnInsert: {
                  dataset: datasetName,
                  origUrl: target,
                  content: "",
                  outgoing: [],
                },
                $addToSet: { incoming: url },
                $inc: { incomingCount: 1 },
              });
          }

          await bulk.execute();
        }

        // Queue new pages
        for (const nextUrl of outgoing) {
          if (visited.size >= maxPages) break;
          if (visited.has(nextUrl)) continue;

          visited.add(nextUrl);
          crawler.queue({ uri: nextUrl });
        }
      } finally {
        done();
      }
    },
  });

  crawler.on("drain", () =>
    resolveDone({
      datasetName,
      totalVisited: visited.size,
      processed,
    })
  );

  crawler.queue({ uri: seedUrl });
  return donePromise;
}

async function main() {
  const which = (process.argv[2] || "all").toLowerCase();
  const maxPagesArg = process.argv.find((a) => a.startsWith("--max="));
  const maxPages = maxPagesArg ? Number(maxPagesArg.split("=")[1]) : Infinity;

  const { client, pages, vocab } = await connectDb();

  try {
    const entries =
      which === "all"
        ? Object.entries(DATASETS)
        : Object.entries(DATASETS).filter(
            ([name]) => name.toLowerCase() === which
          );

    if (entries.length === 0) {
      console.error(
        `Unknown dataset "${which}". Valid: ${Object.keys(DATASETS).join(", ")}`
      );
      process.exit(1);
    }

    for (const [datasetName, seedUrl] of entries) {
      console.log(`\n== Crawling dataset: ${datasetName}`);
      console.log(`Seed: ${seedUrl}`);

      const result = await crawlDataset({
        pages,
        vocab,
        datasetName,
        seedUrl,
        maxPages,
      });

      console.log(
        `Done: visited ${result.totalVisited} pages for ${datasetName}`
      );
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
