const cell = (text, className) => {
    const td = document.createElement("td");
    td.textContent = text;
    if (className) td.className = className;
    return td;
}

const buttonCell = (label, onClick) => {
    const td = document.createElement("td");
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    td.appendChild(btn);
    return td;
}


async function getProducts() {
    let filters = {
        id: null,
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

    // name search
    const name = document.querySelector("#searchInput")?.value.trim();
    if (name) {
        filters.name = name;
    }

    // in stock checkbox
    const inStockCheckbox = document.querySelector("#inStock");
    if (inStockCheckbox) {
        filters.inStock = inStockCheckbox.checked;
    }

    // max price slider
    const maxPrice = Number(document.querySelector("#maxPrice")?.value);
    if (!Number.isNaN(maxPrice)) {
        filters.price.max = maxPrice;
    }

    // dimensions helper
    const setRange = (axis, bound, selector) => {
        const value = Number(document.querySelector(selector)?.value);
        if (!Number.isNaN(value)) {
            filters.dimensions[axis][bound] = value;
        }
    };

    // X dimensions
    // setRange("x", "min", "#x-min");
    setRange("x", "max", "#dimX");

    // Y dimensions
    // setRange("y", "min", "#y-min");
    setRange("y", "max", "#dimY");

    // Z dimensions
    // setRange("z", "min", "#z-min");
    setRange("z", "max", "#dimZ");

    const response = await fetch('/api/filter', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(filters)
    });

    return await response.json();
}

async function displayProducts() {
    const storeBody = document.querySelector('#storeBody')
    storeBody.replaceChildren();

    const products = await getProducts();
    products.forEach(p => {
        const row = document.createElement("tr");

        row.appendChild(cell(p.id));
        row.appendChild(cell(p.name));
        row.appendChild(cell(`$${p.price}`, "price"));
        row.appendChild(cell(p.dimensions.x));
        row.appendChild(cell(p.dimensions.y));
        row.appendChild(cell(p.dimensions.z));
        row.appendChild(cell(p.stock));

        row.appendChild(
            buttonCell("Details", () => {
                window.location.href = `/product/${p.id}`
            })
        );

        storeBody.appendChild(row);
    });
}

async function createProduct() {
    const newProductForm = document.querySelector("#newProduct");
    const name  = newProductForm.querySelector('[data-type="name"]').value.trim();
    const price = Number(newProductForm.querySelector('[data-type="price"]').value);
    const stock = Number(newProductForm.querySelector('[data-type="stock"]').value);

    const dimX = Number(newProductForm.querySelector('[data-type="dimX"]').value);
    const dimY = Number(newProductForm.querySelector('[data-type="dimY"]').value);
    const dimZ = Number(newProductForm.querySelector('[data-type="dimZ"]').value);

    if(!(name && price && stock && dimX && dimY && dimZ)) {
        return;
    }

    const newProduct = {
        name: name,
        price: price,
        stock: stock,
        dimensions: {
            x: dimX,
            y: dimY,
            z: dimZ,
        }
    }

    fetch('/api/create-product', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(newProduct)
    });

    newProductForm.querySelector('[data-type="name"]').value = null;
    newProductForm.querySelector('[data-type="price"]').value = null;
    newProductForm.querySelector('[data-type="stock"]').value = null;
    newProductForm.querySelector('[data-type="dimX"]').value = null;
    newProductForm.querySelector('[data-type="dimY"]').value = null;
    newProductForm.querySelector('[data-type="dimZ"]').value = null;
}

document.addEventListener('DOMContentLoaded', () => {
    displayProducts();

    const filtersForm = document.querySelector("#filter");
    filtersForm.addEventListener('input', () => {
        displayProducts();
    });

    const newProductForm = document.querySelector("#newProduct");
    newProductForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        createProduct();
        displayProducts();
    });

});