export class Product {
    // id: Number, //unique ID for each product 
    // name: String, //the name of the product 
    // price: Number, //price of the product 
    // dimensions: { x: Number, y: Number, z: Number}, //size dimensions of the product 
    // stock: Number //the number of units in stock 
    constructor(id, name, price, dimensions, stock, reviews) {
        this.id = id;
        this.name = name;
        this.price = price;
        this.dimensions = dimensions;
        this.stock = stock;
        this.reviews = reviews
    }

    addReview(name, rating, text) {
        this.reviews.push({name, rating, text});
    }
}