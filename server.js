import express from 'express';
import { Store } from './Store.js';
import { Filter } from './Filter.js'
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

const store = await Store.newInstance('./products.json');

//PAGES
app.get('/', (req, res) => {
  res.redirect('catalogue')
})

app.get('/catalogue', (req, res) => {
  res.sendFile( path.join(__dirname, 'public', 'catalogue.html') );
});

app.get('/product/:productId', (req, res) => {
  const file = fs.readFileSync(path.join(__dirname, 'public', 'product.html'), 'utf8');
  const html = file.replace('{{PRODUCT_ID}}', req.params.productId)
  res.send(html);
});


//APIS
app.post('/api/filter', (req, res) => {
  const filter = Filter.fromJSON(req.body);
  let products = store.search(filter);
  res.status(200).json(products);
});

app.get('/api/catalogue', (req, res) => {
  let products = store.getProducts({});
  res.status(200).json(products);
});

app.post('/api/add-review', (req, res) => {
  const { productId, name, rating, text } = req.body;
  
  const product = store.getProduct(productId);
  product.addReview(name, rating, text);
  res.status(200);
});

app.post('/api/create-product', (req, res) => {
  const { name, price, dimensions: {x,y,z}, stock } = req.body;
  store.createProduct(name, price, {x,y,z}, stock);
  res.status(200);
});


app.listen(port, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});