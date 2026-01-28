// db.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs/promises';

import { Product } from './Product.js'
import { Order } from './Order.js'
import { CartItem } from './CartItem.js'

export class StoreDB {
    constructor(db) {
        this.db = db;
    }

    static async createInstance(path) {
        let db = await open({
            filename: path,
            driver: sqlite3.Database
        });
        return new StoreDB(db);
    }

    static async exists(path) {
        try {
            await fs.access(path);
            return true;
        } catch {
            return false;
        }
    }

    async createTables() {
        await this.db.exec('PRAGMA foreign_keys = ON');

        const schema = await fs.readFile('./sql/schema.sql', 'utf8');
        await this.db.exec(schema);

        // await this.db.close();
    }

    //---------------------------------------------------------
    async addProduct(name, price, {x,y,z}, stock) {
        const cmd = await this.db.prepare(`
            INSERT OR REPLACE INTO Products
                (name, price, dim_x, dim_y, dim_z, stock)
                VALUES (?, ?, ?, ?, ?, ?)
        `);

        try {
            await cmd.run(
                name,
                price,
                x, y, z,
                stock
            )
        } finally {
            await cmd.finalize();
        }
    }

    async addOrder(username, cart) {
        const cmd = await this.db.prepare(`INSERT INTO Orders (username) VALUES (?)`);
        
        try {
            const result = await cmd.run(username);
            const orderId = result.lastID;
            this.addOrderCart(orderId, cart);
        } finally {
            await cmd.finalize();
        }
    }

    async addOrderCart(orderId, cart) { // [{productId, quantity}, ...]
        const cmd = await this.db.prepare(`INSERT INTO OrderCarts(order_id, product_id, quantity) VALUES (?, ?, ?)`);

        try {
            for (const {productId, quantity} of cart) {
                await cmd.run(orderId, productId, quantity);
            }
        } finally {
            cmd.finalize();
        }
        
    }

    async addProductReview(productId, username, rating, comment) {
        const cmd = await this.db.prepare(`
            INSERT INTO ProductReviews (product_id, username, rating, comment)
            VALUES (?, ?, ?, ?)
        `);
        try {
            await cmd.run(productId, username, rating, comment);
        } finally {
            await cmd.finalize();
        }
    }

    //---------------------------------------------------------
    async getProducts({id, name, price, dimensions, inStockOnly} = {}) {
        let sql = `SELECT * FROM Products`;
        const where = [];
        const params = [];

        // id
        if (id != null) {
            where.push(`id = ?`);
            params.push(id);
        }

        // name (partial match)
        if (name) {
            where.push(`LOWER(name) LIKE ?`);
            params.push(`%${name.toLowerCase()}%`);
        }

        // price range
        if (price) {
            const { min, max } = price;

            if (min != null) {
                where.push(`price >= ?`);
                params.push(min);
            }

            if (max != null) {
                where.push(`price <= ?`);
                params.push(max);
            }
        }

        // dimensions
        if (dimensions) {
            const { x, y, z } = dimensions;

            if (x.max) {
                where.push(`dim_x <= ?`);
                params.push(x.max);
            }

            if (y.max) {
                where.push(`dim_y <= ?`);
                params.push(y.max);
            }

            if (z.max) {
                where.push(`dim_z <= ?`);
                params.push(z.max);
            }
        }

        // in-stock only
        if (inStockOnly) {
            where.push(`stock > 0`);
        }

        // finalize query
        if (where.length > 0) {
            sql += ` WHERE ` + where.join(' AND ');
        }

        const results = await this.db.all(sql, params);
        return Promise.all(results.map(async (row) => {
            const dimensions = { 
                x: row.dim_x, 
                y: row.dim_y, 
                z: row.dim_z
            };
            const reviews = await this.getProductReviews({ productId: row.id });
            return new Product(row.id, row.name, row.price, dimensions, row.stock, reviews);
        }))
    }


    async getOrders({ id, username } = {}) {
        let sql = `SELECT * FROM Orders`;
        const where = [];
        const params = [];

        if (id != null) {
            where.push(`id = ?`);
            params.push(id);
        }

        if (username) {
            where.push(`username = ?`);
            params.push(username);
        }

        if (where.length) {
            sql += ` WHERE ` + where.join(' AND ');
        }

        return Promise.all(
            results.map(async (row) => {
                const cart = await this.getOrderCarts({ orderId: row.id });
                return new Order(row.username, cart);
            })
        );
    }

    async getOrderCarts({ orderId, productId } = {}) {
        let sql = `SELECT * FROM OrderCarts`;
        const where = [];
        const params = [];

        if (orderId != null) {
            where.push(`order_id = ?`);
            params.push(orderId);
        }

        if (productId != null) {
            where.push(`product_id = ?`);
            params.push(productId);
        }

        if (where.length) {
            sql += ` WHERE ` + where.join(' AND ');
        }

        const results = await this.db.all(sql, params);
        return results.map(row => {
            return new CartItem(row.product_id, row.quantity);
        });
    }

    async getProductReviews({ productId, username, rating } = {}) {
        let sql = `SELECT * FROM ProductReviews`;
        const where = [];
        const params = [];
        if (productId != null) {
            where.push(`product_id = ?`);
            params.push(productId);
        }
        if (username) {
            where.push(`username = ?`);
            params.push(username);
        }
        if (rating != null) {
            where.push(`rating = ?`);
            params.push(rating);
        }
        if (where.length) {
            sql += ` WHERE ` + where.join(' AND ');
        }
        const results = await this.db.all(sql, params);
        return results.map(row => {
            return {
                // productId: row.product_id,
                name: row.username,
                rating: row.rating,
                text: row.comment
            }
        });
    }

}