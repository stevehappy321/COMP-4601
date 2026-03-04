import fs from 'fs/promises';
import { Product } from './Product.js';
import { StoreDB } from './StoreDB.js';

export class Store {
    constructor(db) {
        this.db = db;
    }

    static async newInstance(dbpath, jsonpath) { 
        if (await StoreDB.exists(dbpath)) {
            const db = await StoreDB.createInstance(dbpath);
            await db.createTables();
            return new Store(db);
        }

        const db = await StoreDB.createInstance(dbpath);
        await db.createTables();

        const products = await Store.readProductsFromFile(jsonpath);
        for(const p of products) {
            await db.addProduct(
                p.name,
                p.price,
                p.dimensions,
                p.stock
            )
        }
        return new Store(db);
    }

    static async readProductsFromFile(filePath) {
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
                return [];
            }

        } catch (error) {
            console.error('Error reading or parsing JSON file:', error);
            return [];
        }
    }

    async filterProducts(filter) {
        return await this.db.getProducts(filter);
    }

    async getOrders(filter) {
        return await this.db.getOrders(filter);
    }

    //----------------------------------
    async addProduct(name, price, {x,y,z}, stock) {
        await this.db.addProduct(name, price, {x,y,z}, stock);
    }

    async addProductReview(productId, name, rating, comment) {
        await this.db.addProductReview(productId, name, rating, comment);
    }

    async addOrder(name, cart) {
        await this.db.addOrder(name, cart);
    }

    //----------------------------------
    inRange(value, min, max) {
        return value >= min && value <= max;
    }

}


