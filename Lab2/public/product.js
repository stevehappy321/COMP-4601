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


async function getProduct() {
    const response = await fetch(document.body.getAttribute('data-action'), {
        method: document.body.getAttribute('data-method'),
        headers: {
            'Content-Type': 'application/json'
        }
    });

    const products = await response.json();
    return products[0];
}

async function displayProduct() {    
    const product = await getProduct();

    const h1 = document.body.querySelector("h1");
    h1.textContent = h1.textContent.replace("{{PRODUCT_NAME}}", product.name);

    const detailsDiv = document.querySelector('#productDetails');
    detailsDiv.replaceChildren();

    const values = [
        `Price: $${product.price}`,
        `Dimensions: ${product.dimensions.x} x ${product.dimensions.y} x ${product.dimensions.z}`,
        `Stock: ${product.stock}`
    ];

    values.forEach(text => {
        const label = document.createElement("label");
        label.textContent = text;
        label.style.display = "block"; // separate line

        detailsDiv.appendChild(label);
    });

    const productReviews = await (await fetch(document.querySelector('#reviews').getAttribute('data-action'), {
        method: document.querySelector('#reviews').getAttribute('data-method'),
        headers: {
            'Content-Type': 'application/json'
        }
    })).json();

    const reviews = document.querySelector('#reviews');    
    reviews.replaceChildren();
    for (const review of productReviews) {
        reviews.appendChild(productReview(review.name, review.rating, review.text));
    }
}

async function createReview(form) {
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

    fetch(form.getAttribute('data-action'), {
        method: form.getAttribute('data-method'),
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(newReview)
    })

    form.reset();
}

document.addEventListener('DOMContentLoaded', () => {
    displayProduct();

    const form = document.querySelector("#review_form");
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        createReview(form);
        displayProduct();
    });
});