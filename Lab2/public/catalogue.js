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


async function fetchProducts(filtersForm) {
    const filters = {
        id: null,
        name: document.querySelector("#searchInput")?.value.trim(),
        price: Number(document.querySelector("#maxPrice")?.value),
        x: document.querySelector("#dimX")?.value,
        y: document.querySelector("#dimY")?.value,
        z: document.querySelector("#dimZ")?.value,
        inStockOnly: document.querySelector("#inStock")?.checked,
    };

    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value === null || value === undefined) continue;

        // skip NaN numbers
        if (typeof value === "number" && Number.isNaN(value)) continue;

        // only send inStockOnly when true
        if (key === "inStockOnly" && value === false) continue;

        // skip empty strings
        if (value === "") continue;

        params.append(key, value);
    }
    
    const response = await fetch(`${filtersForm.getAttribute("data-action")}?${params}`, {
        method: filtersForm.getAttribute("data-method"),
        headers: {
            'Content-Type': 'application/json'
        }
    });

    return await response.json();
}

async function displayProducts(filtersForm) {
    const storeBody = document.querySelector('#storeBody')
    storeBody.replaceChildren();

    const products = await fetchProducts(filtersForm);
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
                window.location.href = p.link;
            })
        );

        storeBody.appendChild(row);
    });
}

async function createProduct(newProductForm) {
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

    fetch(newProductForm.getAttribute("data-action"), {
        method: newProductForm.getAttribute("data-method"),
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
    const filtersForm = document.querySelector("#filter");
    const newProductForm = document.querySelector("#newProduct");

    displayProducts(filtersForm);

    filtersForm.addEventListener('input', () => {
        displayProducts(filtersForm);
    });
    
    newProductForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        createProduct(newProductForm);
        displayProducts(filtersForm);
    });
});