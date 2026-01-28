import express from 'express';
import { Store } from './backend/Store.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from "fs";

const hostname = '127.0.0.1';
const port = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static('public'));  // serve static HTML & JS files

const store = await Store.newInstance( 
  path.join(__dirname, 'sql', 'store.db'), 
  path.join(__dirname, 'backend', 'products.json')
);

//PAGES-------------------------------
app.get('/', (req, res) => {
  res.redirect('catalogue')
})

app.get('/catalogue', (req, res) => {
  res.status(200).sendFile( path.join(__dirname, 'public', 'catalogue.html') );
});

app.get('/product/:productId', (req, res) => {
  const file = fs.readFileSync(path.join(__dirname, 'public', 'product.html'), 'utf8');
  const html = file.replaceAll('{{PRODUCT_ID}}', req.params.productId)
  res.status(200).send(html);
});



//APIS-------------------------------
app.get('/api/products', async (req, res) => {
  const { id, name, price, x, y, z, inStockOnly } = req.query;
  let products = await store.filterProducts({ id, name, price, x, y, z, inStockOnly });
  res.status(200).json(products.map(p => {
    return {
      ...p,
      link: `/product/${p.id}`
    }
  }));
});

app.post('/api/products', async (req, res) => {
  const { name, price, dimensions: {x,y,z}, stock } = req.body;
  await store.addProduct(name, price, {x,y,z}, stock);
  res.status(200);
});


app.get('/api/reviews/:productId', async (req, res) => {
  const productId = req.params.productId;
  
  const products = await store.filterProducts({ id: productId });
  if (products.length === 0) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  const product = products[0];
  res.status(200).json(product.reviews);
});

app.post('/api/reviews', async (req, res) => {
  const { productId, name, rating, text } = req.body;
  await store.addProductReview(productId, name, rating, text);
  res.status(200);
});


app.get('/orders/:productId'), async (req, res) => {
  const productId = req.params.productId;
  const orders = await store.getOrders({id: productId});
  res.status(200).json(orders);
};

app.post('/orders', async (req, res) => {
  const { cart } = req.body; // [{productId, quantity}, ...]
  await store.addOrder("", cart);
  res.status(200);
});



app.listen(port, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});