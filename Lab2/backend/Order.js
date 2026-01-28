import { CartItem } from "./CartItem.js";

export class Order {
    constructor(name, cart) {
        this.name = name;
        this.cart = cart;
    }

    static fromJSON(json) {
        const { name, cart } = json;
        return new Order(name, cart.map(item => CartItem.fromJSON(item)));
    }
}