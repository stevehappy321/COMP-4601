export class Filter {
    constructor(id, name, {max, min}, {x,y,z}, inStockOnly) {
        this.id = id;
        this.name = name;
        this.price = {max: max, min: min};
        this.dimensions = {
            x: x,
            y: y,
            z: z,
        };
        this.inStockOnly = inStockOnly;
    }

    static fromJSON(json) {
        let {id, name, price, dimensions, inStock} = json;
        price = { min: 0, max: price.max || Infinity };
        dimensions = {
            x: { min: 0, max: dimensions.x.max || Infinity },
            y: { min: 0, max: dimensions.y.max || Infinity },
            z: { min: 0, max: dimensions.z.max || Infinity },
        };
        inStock = inStock == true;

        return new Filter(id, name, price, dimensions, inStock);
    }
}