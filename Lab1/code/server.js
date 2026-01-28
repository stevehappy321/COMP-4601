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
  res.status(200).sendFile( path.join(__dirname, 'public', 'catalogue.html') );
});

app.get('/product/:productId', (req, res) => {
  const file = fs.readFileSync(path.join(__dirname, 'public', 'product.html'), 'utf8');
  const html = file.replaceAll('{{PRODUCT_ID}}', req.params.productId)
  res.status(200).send(html);
});


//APIS
app.get('/api/products', (req, res) => {
  const { id, name, price, x, y, z, inStockOnly } = req.query;
  const dimensions = {x, y, z};
  let products = store.search({ id, name, price, dimensions, inStockOnly });

  console.log({ id, name, price, x, y, z, inStockOnly })

  res.status(200).json(products.map(p => {
    return {
      ...p,
      link: `/product/${p.id}`
    }
  }));
});

app.post('/api/products', (req, res) => {
  const { name, price, dimensions: {x,y,z}, stock } = req.body;
  store.createProduct(name, price, {x,y,z}, stock);
  res.status(200);
});


app.get('/api/reviews/:productId', (req, res) => {
  const productId = req.params.productId;
  
  const product = store.getProduct(productId);
  res.status(200).json(product.reviews);
});

app.post('/api/reviews', (req, res) => {
  const { productId, name, rating, text } = req.body;
  
  const product = store.getProduct(productId);
  product.addReview(name, rating, text);
  res.status(200);
});





app.listen(port, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});