PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    dim_x REAL,
    dim_y REAL,
    dim_z REAL,
    stock INTEGER
);

CREATE TABLE IF NOT EXISTS Orders (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS OrderCarts (
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,

    PRIMARY KEY (order_id, product_id),

    FOREIGN KEY (order_id)
        REFERENCES Orders(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    FOREIGN KEY (product_id)
        REFERENCES Products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS ProductReviews (
    product_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    rating REAL NOT NULL,
    comment TEXT,

    FOREIGN KEY (product_id)
        REFERENCES Products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);