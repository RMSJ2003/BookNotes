How to Run This Website?

Step 1. Prepare the following:
- Postgres: user, host, database name, password, port
- email

Step 2. Create a Database Schema, run this PostgreSQL queries in order:

CREATE TABLE books (
	id SERIAL PRIMARY KEY,
	title VARCHAR(50) NOT NULL,
	author VARCHAR(50) NOT NULL,
	cover_id VARCHAR(20) NOT NULL,
    UNIQUE(title, author)
);

CREATE TABLE summary (
    id SERIAL PRIMARY KEY,
    summary TEXT NOT NULL,
    read_date DATE NOT NULL,
    rating INTEGER NOT NULL,
    book_id INTEGER REFERENCES books(id),
    UNIQUE (book_id)
);

CREATE TABLE notes (
	id SERIAL PRIMARY KEY,
	notes TEXT NOT NULL,
	update_date DATE NOT NULL,
	book_id INTEGER REFERENCES books(id),
	UNIQUE (book_id)
);

CREATE TABLE accounts (
	id SERIAL PRIMARY KEY,
	username VARCHAR(20) NOT NULL,
	password TEXT NOT NULL,
	UNIQUE (username)
);

INSERT INTO accounts (username, password)
VALUES ('MyUsername', 'MyPassword');

Step 3: Open terminal in your VS Code and cd to Project Book Notes directory. Enter "npm i" and "npm i -g nodemon"

Step 4 (last): In the same directory, enter "nodemon index.js"