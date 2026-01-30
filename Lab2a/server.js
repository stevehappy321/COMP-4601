const express = require("express");
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const app = express();
app.use(express.json());
app.use(express.static("public"));

//MongoDB config vars

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB || "comp4601_lab2";

let db, productsCol, ordersCol, countersCol;

// MongoDB helpers
async function getNextId(name) {
  //Ensure doc exists
  await countersCol.updateOne(
    { _id: name },
    { $setOnInsert: { seq: 0 } },
    { upsert: true }
  );

  //Increment and fetch the updated doc
  const result = await countersCol.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    {
      upsert: true,
      returnDocument: "after", // newer drivers
      returnOriginal: false    // older drivers
    }
  );

  //Some environments still may not populate result.value; fetch directly if needed
  const doc = result?.value || (await countersCol.findOne({ _id: name }));

  //First returned id should be 0:
  //seq starts at 0, we increment to 1, so id = seq - 1 = 0
  return (doc.seq - 1);
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

//Product routes
app.post("/products", async (req, res) => {
  const { name, price, dimensions: {x,y,z}, stock } = req.body;

  if (!name || typeof price !== "number" || typeof stock !== "number" || !x || !y || !z) {
    return res.status(409).json({ error: "Invalid product format" });
  }

  const product = {
    id: await getNextId("products"),
    name,
    price,
    dimensions: {
      x,y,z
    },
    stock,
  };
  await productsCol.insertOne(product);
  res.status(201).json(product);
});

app.get("/products", async (req, res) => {
  const products = await productsCol.find().toArray();
  products.forEach(p => {
    p.href = `/products/${p.id}`;
  });
  res.json(products);
});

app.get("/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  const product = await productsCol.findOne({ id });
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }
  res.json(product);
});

app.post("/products/:id/reviews", async (req, res) => {
  const id = Number(req.params.id);
  const { reviewer, rating, comment } = req.body;

  const product = await productsCol.findOne({ id });
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  const review = {
    reviewer,
    rating,
    comment,
    date: new Date().toISOString()
  };

  await productsCol.updateOne(
    { id },
    { $push: { reviews: review } }
  );

  res.status(201).json(review);
});

app.get("/products/:id/reviews", async (req, res) => {
  const id = Number(req.params.id);
  const product = await productsCol.findOne({ id });
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }
  res.json(product.reviews || []);
});

//Order route, lab 2 addition

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
      return res.status(409).json({
        error: `Product ${item.productId} does not exist`
      });
    }

    if (product.stock < item.quantity) {
      return res.status(409).json({
        error: `Insufficient stock for product ${product.name}`
      });
    }

    total += product.price * item.quantity;
    purchasedItems.push({
      productId: product.id,
      quantity: item.quantity,
    });
  }

  //Update stock
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
    date: new Date().toISOString()
  };

  await ordersCol.insertOne(order);

  res.status(201).json(order);
});

app.get("/orders", async (req, res) => {
  const orders = await ordersCol.find().toArray();
  orders.forEach(o => {
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
