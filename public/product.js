const productReview = (name, rating, text) => {
    const review = document.createElement("div");
    review.className = "review";

    const header = document.createElement("div");
    header.className = "review-header";

    const nameSpan = document.createElement("div");
    nameSpan.className = "name";
    nameSpan.textContent = name;

    const ratingSpan = document.createElement("div");
    ratingSpan.className = "rating";
    ratingSpan.textContent = `${rating}/10`;

    const textDiv = document.createElement("div");
    textDiv.className = "text";
    textDiv.textContent = text;

    header.append(nameSpan, ratingSpan);
    review.append(header, textDiv);

    return review;
}


async function getProduct(productId) {
    let filters = {
        id: productId,
        name: null,
        price: {
            min: 0,
            max: null
        },
        dimensions: {
            x: { min: 0, max: null },
            y: { min: 0, max: null },
            z: { min: 0, max: null }
        },
        inStock: true,
    }

    const response = await fetch('/api/filter', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(filters)
    });

    const products = await response.json();
    return products[0];
}

async function displayProduct(productId) {    
    const product = await getProduct(productId);

    const h1 = document.body.querySelector("h1");
    h1.textContent = h1.textContent.replace("{{PRODUCT_NAME}}", product.name);

    const reviews = document.querySelector('#reviews');
    reviews.replaceChildren();
    for (const review of product.reviews) {
        reviews.appendChild(productReview(review.name, review.rating, review.text));
    }
}

async function createReview() {
    const form = document.querySelector("#review_form");
    const productId = document.body.getAttribute('data-product-id');
    const name = form.querySelector('#reviewer_name').value.trim()
    const rating = Number(form.querySelector('#rating_slider').value);
    const text = form.querySelector('#review_text').value.trim();

    if (!name) {
        return;
    }

    const newReview = {
        productId: productId,
        name: name,
        rating: rating,
        text: text,
    }

    fetch("/api/new-review", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(newReview)
    })

    form.reset();
}

document.addEventListener('DOMContentLoaded', () => {
    const productId = document.body.getAttribute('data-product-id');
    displayProduct(productId);
});

const form = document.querySelector("#review_form");
form.addEventListener('submit', () => {
    createReview();
    displayProduct(productId)
});