export class Review {
    constructor(name, rating, text) {
        this.name = name;
        this.rating = rating;
        this.text = text;
    }

    static fromJSON(json) {
        const { name, rating, text } = json;
        return new Review(name, rating, text);
    }
}