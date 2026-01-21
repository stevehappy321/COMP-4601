import fs from 'fs/promises';
import { Product } from './Product.js';

export class Store {
    constructor(products) {
        this.products = products;
    }

    static async newInstance(filepath) {
        const products = await Store.parseStoreFromFile(filepath);
        return new Store(products);
    }

    static async parseStoreFromFile(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            let jsonObject = JSON.parse(data);

            if(Array.isArray(jsonObject)) {
                let products = []
                for (const {id, name, price, dimensions, stock, reviews = []} of jsonObject) {
                    products.push(new Product(id, name, price, dimensions, stock, reviews))
                }
                return products;
            } else {
                return [new Product()]
            }

        } catch (error) {
            console.error('Error reading or parsing JSON file:', error);
            return [];
        }
    }

    search(filter) {
        const {id, name, price, dimensions, inStockOnly} = filter;
        let products = this.products;

        // ID
        products = products.filter(product => {
            if (id == null) return true;
            if (id == product.id) return true;
            return false;
        })

        // name
        products = products.filter(product => {
            if (name == null) return true;
            if (product.name.toLowerCase().includes(name.toLowerCase())) return true;
            return false;
        })

        // price
        products = products.filter(product => {
            if (price == null) return true;
            const { min, max } = price;
            if (product.price >= min && product.price <= max) return true;
            return false;
        });

        // dimensions
        products = products.filter(product => {
            if (dimensions == null) return true;
            const { x, y, z } = dimensions;
            if (this.inRange(product.dimensions.x, x.min, x.max) &&
                this.inRange(product.dimensions.y, y.min, y.max) &&
                this.inRange(product.dimensions.z, z.min, z.max)
            ) {
                return true;
            }
            return false;
        });

        // stock
        products = products.filter(product => {
            if(!inStockOnly) return true;
            if(product.stock > 0) return true;
            return false;
        });

        return products;
    }

    getProduct(productId) {
        return this.products.find(item => item.id == productId)
    }

    getProducts() {
        return this.products;
    }

    createProduct(name, price, {x,y,z}, stock) {
        this.products.push(
            new Product(this.firstAvailableId(), name, price, {x,y,z}, stock,)
        )
    }

    //----------------------------------
    firstAvailableId() {
        const used = new Set(this.products.map(item => item.id));

        let id = 0;
        while (used.has(id)) {
            id++;
        }

        return id;
    }

    inRange(value, min, max) {
        return value >= min && value <= max;
    }

}