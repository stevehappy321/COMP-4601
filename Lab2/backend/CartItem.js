export class CartItem {
    constructor(productId, quantity) {
        this.productId = productId;
        this.quantity = quantity;
    }

    static fromJSON(json) {
        const { productId, quantity } = json;
        return new CartItem(productId, quantity);
    }
}