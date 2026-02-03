const express = require("express");
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const app = express();
app.use(express.json());
app.use(express.static("public"));

// ---- Content negotiation helpers (Lab 1 HTML/JSON support) ----
function wantsHTML(req) {
  const format = (req.query.format || "").toLowerCase();
  if (format === "html") return true;
  if (format === "json") return false;
  const accept = (req.headers.accept || "").toLowerCase();
  return accept.includes("text/html");
}

function sendRepresentation(req, res, jsonObj, htmlStr) {
  if (wantsHTML(req)) {
    res.type("html").send(htmlStr);
  } else {
    res.json(jsonObj);
  }
}

//MongoDB config vars
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB || "comp4601_lab2";

let db, productsCol, ordersCol, countersCol;

// MongoDB helpers
async function getNextId(name) {
  // Ensure doc exists
  await countersCol.updateOne(
    { _id: name },
    { $setOnInsert: { seq: 0 } },
    { upsert: true }
  );

  // Increment and fetch the updated doc
  const result = await countersCol.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    {
      upsert: true,
      returnDocument: "after", // newer drivers
      returnOriginal: false, // older drivers
    }
  );

  // Some environments still may not populate result.value; fetch directly if needed
  const doc = result?.value || (await countersCol.findOne({ _id: name }));

  // First returned id should be 0:
  // seq starts at 0, we increment to 1, so id = seq - 1 = 0
  return doc.seq - 1;
}

async function seedProductsIfNeeded() {
  const count = await productsCol.countDocuments();
  if (count > 0) return;

  const filePath = path.join(__dirname, "products.json");
  const raw = fs.readFileSync(filePath);
  const products = JSON.parse(raw);

  for (const p of products) {
    p.id = await getNextId("products");
    if (!Array.isArray(p.reviews)) p.reviews = [];
    await productsCol.insertOne(p);
  }

  console.log("Products added into MongoDB");
}

// -------------------- Product routes --------------------
app.get("/products", async (req, res) => {
  const name = (req.query.name || "").trim();
  const stock = (req.query.stock || "all").toLowerCase();

  const filter = {};
  if (name) {
    filter.name = { $regex: name, $options: "i" };
  }
  if (stock === "instock") {
    filter.stock = { $gt: 0 };
  }

  const products = await productsCol.find(filter).toArray();
  products.forEach((p) => (p.href = `/products/${p.id}`));
  res.json(products);
});

app.post("/products", async (req, res) => {
  const { name, price, dimensions, stock } = req.body || {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Missing product name" });
  }

  const p = Number(price);
  const s = Number(stock);
  const dims = dimensions || {};
  const x = Number(dims.x),
    y = Number(dims.y),
    z = Number(dims.z);

  if (!Number.isFinite(p) || p < 0) {
    return res.status(400).json({ error: "Invalid price" });
  }
  if (![x, y, z].every((v) => Number.isFinite(v) && v >= 0)) {
    return res.status(400).json({ error: "Invalid dimensions" });
  }
  if (!Number.isInteger(s) || s < 0) {
    return res.status(400).json({ error: "Invalid stock" });
  }

  const product = {
    id: await getNextId("products"),
    name: name.trim(),
    price: p,
    dimensions: { x, y, z },
    stock: s,
    reviews: [],
  };

  await productsCol.insertOne(product);
  res.status(201).json({ ...product, href: `/products/${product.id}` });
});

app.get("/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  const product = await productsCol.findOne({ id });
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  const payload = {
    ...product,
    href: `/products/${product.id}`,
    reviewsHref: `/products/${product.id}/reviews`,
  };
  const html = renderProductHTML(payload);
  sendRepresentation(req, res, payload, html);
});

app.get("/products/:id/reviews", async (req, res) => {
  const id = Number(req.params.id);
  const product = await productsCol.findOne(
    { id },
    { projection: { id: 1, name: 1, reviews: 1 } }
  );
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  const payload = {
    productId: product.id,
    productName: product.name,
    reviews: Array.isArray(product.reviews) ? product.reviews : [],
    href: `/products/${product.id}/reviews`,
    productHref: `/products/${product.id}`,
  };
  const html = renderReviewsHTML(payload);
  sendRepresentation(req, res, payload, html);
});

app.post("/products/:id/reviews", async (req, res) => {
  const id = Number(req.params.id);
  const { reviewer, rating, comment } = req.body || {};

  const product = await productsCol.findOne({ id });
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  const r = Number(rating);
  if (!Number.isFinite(r) || r < 1 || r > 10) {
    return res
      .status(400)
      .json({ error: "Rating must be a number from 1 to 10" });
  }

  const review = {
    rating: r,
    ...(reviewer ? { reviewer } : {}),
    ...(comment ? { comment } : {}),
    date: new Date().toISOString(),
  };

  await productsCol.updateOne({ id }, { $push: { reviews: review } });

  res.status(201).json(review);
});

// -------------------- Order routes (Lab 2) --------------------
app.post("/orders", async (req, res) => {
  const { name, items } = req.body;

  if (!name || !Array.isArray(items) || items.length === 0) {
    return res.status(409).json({ error: "Invalid order format" });
  }

  let total = 0;
  const purchasedItems = [];

  for (const item of items) {
    const product = await productsCol.findOne({ id: item.productId });
    if (!product) {
      return res
        .status(409)
        .json({ error: `Product ${item.productId} does not exist` });
    }

    if (product.stock < item.quantity) {
      return res
        .status(409)
        .json({ error: `Insufficient stock for product ${product.name}` });
    }

    total += product.price * item.quantity;
    purchasedItems.push({
      productId: product.id,
      name: product.name,
      quantity: item.quantity,
      price: product.price,
    });
  }

  // Update stock
  for (const item of items) {
    await productsCol.updateOne(
      { id: item.productId },
      { $inc: { stock: -item.quantity } }
    );
  }

  const order = {
    id: await getNextId("orders"),
    name,
    items: purchasedItems,
    total,
    date: new Date().toISOString(),
  };

  await ordersCol.insertOne(order);

  res.status(201).json(order);
});

app.get("/orders", async (req, res) => {
  const orders = await ordersCol.find().toArray();
  orders.forEach((o) => {
    o.href = `/orders/${o.id}`;
  });
  res.json(orders);
});

app.get("/orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  const order = await ordersCol.findOne({ id });
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  res.json(order);
});

// ---- HTML renderers (Lab 1 requirement) ----
function escapeHTML(v) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PRODUCT_HTML_TEMPLATE = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Product {{id}}</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <h1>Product Details</h1>

  <section>
    <div class="row"><b>ID</b>: {{id}}</div>
    <div class="row"><b>Name</b>: {{name}}</div>
    <div class="row"><b>Price</b>: \${{price}}</div>
    <div class="row"><b>Dimensions</b>: {{x}} × {{y}} × {{z}}</div>
    <div class="row"><b>Stock</b>: {{stock}}</div>
    <div class="row">
      <b>Reviews</b>:
      <a href="/products/{{id}}/reviews?format=html">View reviews</a>
    </div>
  </section>

  <section>
    <a href="/">← Back to Home</a>
  </section>
</body>
</html>`;


const REVIEWS_HTML_TEMPLATE = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Reviews for Product {{id}}</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <h1>Reviews</h1>

  <section>
    <div class="row"><b>Product ID</b>: {{id}}</div>
    <div class="row"><b>Product Name</b>: {{name}}</div>
    <div class="row">
      <b>Back</b>:
      <a href="/products/{{id}}?format=html">Product details</a>
    </div>
  </section>

  <section>
    <h2>Review List</h2>
    {{reviewsList}}
  </section>

  <section>
    <a href="/">← Back to Home</a>
  </section>
</body>
</html>`;


function renderProductHTML(product) {
  const safe = {
    id: escapeHTML(product.id),
    name: escapeHTML(product.name),
    price: escapeHTML(product.price),
    stock: escapeHTML(product.stock),
    x: escapeHTML(product.dimensions?.x ?? ""),
    y: escapeHTML(product.dimensions?.y ?? ""),
    z: escapeHTML(product.dimensions?.z ?? "")
  };

  return PRODUCT_HTML_TEMPLATE
    .replaceAll("{{id}}", safe.id)
    .replaceAll("{{name}}", safe.name)
    .replaceAll("{{price}}", safe.price)
    .replaceAll("{{stock}}", safe.stock)
    .replaceAll("{{x}}", safe.x)
    .replaceAll("{{y}}", safe.y)
    .replaceAll("{{z}}", safe.z);
}

function renderReviewsHTML(payload) {
  const reviews = Array.isArray(payload.reviews) ? payload.reviews : [];

  const listHtml = reviews.length
    ? `<ul>${reviews
        .map((r) => {
          const rating = escapeHTML(r.rating);
          const who = r.reviewer ? ` — ${escapeHTML(r.reviewer)}` : "";
          const when = r.date ? ` <i>(${escapeHTML(r.date)})</i>` : "";
          const comment = r.comment ? `<div>${escapeHTML(r.comment)}</div>` : "";
          return `<li><b>${rating}/10</b>${who}${when}${comment}</li>`;
        })
        .join("")}</ul>`
    : "<p><i>No reviews yet.</i></p>";

  const safeId = escapeHTML(payload.productId);
  const safeName = escapeHTML(payload.productName);

  return REVIEWS_HTML_TEMPLATE
    .replaceAll("{{id}}", safeId)
    .replaceAll("{{name}}", safeName)
    .replaceAll("{{reviewsList}}", listHtml);
}


//Server Setup
async function start() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();

  db = client.db(DB_NAME);
  productsCol = db.collection("products");
  ordersCol = db.collection("orders");
  countersCol = db.collection("counters");

  await seedProductsIfNeeded();

  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
