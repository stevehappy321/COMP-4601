const productCard = (product) => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
        <h2>${product.name}</h2>
        <p class="price">$${product.price}</p>

        <div class="details">
            <p><strong>Dimensions:</strong></p>
            <ul>
                <li>X: ${product.dimensions.x}</li>
                <li>Y: ${product.dimensions.y}</li>
                <li>Z: ${product.dimensions.z}</li>
            </ul>
            <p><strong>In stock:</strong> ${product.inStock}</p>
            <p><strong>Product ID:</strong> ${product.id}</p>
        </div>
        <button>Add to Cart</button>
    `;
    return card;
}

// async function displayProducts() {
//     const products = await getProducts();

//     const store = document.querySelector(".store");
//     store.innerHTML = '';
//     products.forEach(product => {
//         const card = productCard(product);
//         store.appendChild(card);
//     });
// }