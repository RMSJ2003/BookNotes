import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";

const app = express();
const port = 3000;

// Replace with your own email
const email = "richardmontemayorsahagunjr@gmail.com";
const API_URL = "https://www.googleapis.com/books/v1/volumes";

// Replace with your own Postgres information
const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "bookNotes",
    password: "PostgresLearning2003",
    port: 5432
});
db.connect();

app.use(express.static("public"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

let bookNotes = [];

async function getBookNotes(sort) {
    bookNotes = [];
    const result = await db.query(`SELECT books.id id, title, author, books.cover_id cover_id, TO_CHAR(read_date, 'YYYY-MM-DD') read_date, summary, rating, notes, TO_CHAR(update_date, 'YYYY-MM-DD') update_date FROM books JOIN summary ON summary.book_id = books.id JOIN notes ON notes.book_id = books.id ${sort} ;`);
    result.rows.forEach((book) => {
        bookNotes.push(book);
    });
};

async function getCoverID(title, author) {
    const response = await axios.get(`${API_URL}`, {
        params: {
            q: `intitle:${title}+inauthor:${author}`,
            orderBy: "newest"
        }
    });

    return response.data.items[0].id;    
};

async function checkUniqueness(title, author) {
    const result = await db.query("SELECT LOWER(title) title, LOWER(author) author FROM books;");
    let unique = true;
    result.rows.forEach((book) => {
        book.title === title.toLowerCase() 
        && book.author === author.toLowerCase() 
        ? unique = false : unique = true;
    });
    return unique;
};

async function getDateToday() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Month is zero-based, so we add 1 and pad with zeros.
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}


async function getBookNoteFromForm(form) {
    return {
        id: form?.id, //if form exists and has a property id, assign form.id to id; otherwise, assign undefined to id
        title: form.title,
        author: form.author,
        summary: form.summary,
        date: form.date,
        rating: form.rating,
        notes: form.notes,
        update_date: form?.update_date,
        cover_id: form?.cover_id
    }
}

app.get("/", async (req, res) => {
    bookNotes = [];
    await getBookNotes("ORDER BY read_date DESC");
    res.render("bookList.ejs", {
        email: email, 
        books: bookNotes
    });
});

app.post("/notes", async (req, res) => {
    res.render("notes.ejs", {
        book: await getBookNoteFromForm(req.body)
    });
});

app.get("/authentication", (req, res) => {
    res.render("authentication.ejs");
});

app.post("/login", async (req, res) => {
    try {
        const loginInput = {
            username: req.body.username,
            password: req.body.password
        };
        const result = await db.query("SELECT * FROM accounts WHERE username = $1", [loginInput.username]);
        // Checks if username and password exists in database
        if (result.rows.length > 0) {
            const data = result.rows[0];
            const password = data.password;

            if (loginInput.password === password) {
                res.redirect("/modify");
            }
            else {
                res.render("authentication.ejs", {
                    error: `Incorrect password!`
                });
            }
            // Your code to handle successful login here.
        } else {
            // Handle the case when no user with the provided usernamE is found.
            res.render("authentication.ejs", {
                error: `Username does not exist!`
            });
        }
    } catch (err) {
        console.log(err);
    }
});

app.get("/modify", async (req, res) => {
    bookNotes = [];
    await getBookNotes("ORDER BY read_date DESC");
    res.render("modify.ejs", {
        books: bookNotes
    });
});

app.post("/create", async (req, res) => {
    try {
        const bookNote = await getBookNoteFromForm(req.body);

        if (await checkUniqueness(bookNote.title, bookNote.author)) {
            const coverID = await getCoverID(bookNote.title, bookNote.author);
            const bookID_result = await db.query("INSERT INTO books (title, author, cover_id) VALUES ($1, $2, $3) RETURNING id;"
            , [bookNote.title, bookNote.author, coverID]
            );
            const bookID = bookID_result.rows[0].id;
            const dateToday = await getDateToday();
            
            await db.query("INSERT INTO summary (summary, read_date, rating, book_id) VALUES ($1, $2, $3, $4);", [bookNote.summary, bookNote.date, bookNote.rating, bookID]);
            await db.query("INSERT INTO notes (notes, update_date, book_id) VALUES ($1, $2, $3);", [bookNote.notes, dateToday, bookID]);
    
            res.render("crudForm.ejs", {
                formAction: "/create",
                message: "Successful!"
            }); 

        } else if (!(await checkUniqueness(bookNote.title, bookNote.author))) {
            res.render("crudForm.ejs", {
                formAction: "/create",
                message: "The book already exists in your list!"
            }); 
        }

    } catch (err) {
        console.log(err);
    }
});

app.post("/update", async (req, res) => {
    try {
        const bookNote = await getBookNoteFromForm(req.body);
        const dateToday = await getDateToday();

        await db.query("UPDATE notes SET notes = $1, update_date = $2 WHERE book_id = $3;", [bookNote.notes, dateToday, bookNote.id]);
        await db.query("UPDATE summary SET rating = $1 WHERE book_id = $2;", [bookNote.rating, bookNote.id]);

        res.render("crudForm.ejs", {
            formAction: "/update",
            bookNote: bookNote,
            message: "Successful!"
        }); 

    } catch (err) {
        console.log(err);
    }

});

app.post("/crud", async (req, res) => {

    const bookNote = await getBookNoteFromForm(req.body);
    let formAction;

    if (req.body.create) formAction = "/create";
    else if (req.body.update) formAction = "/update";
    else if (req.body.delete) formAction = "/delete"

    res.render("crudForm.ejs", {
        formAction: formAction,
        bookNote: bookNote
    });
});

app.post("/delete", async (req, res) => {
    try {
        const bookNote = await getBookNoteFromForm(req.body);

        await db.query("DELETE FROM notes WHERE book_id = $1;", [bookNote.id]);
        await db.query("DELETE FROM summary WHERE book_id = $1;", [bookNote.id]);
        await db.query("DELETE FROM books WHERE id = $1;", [bookNote.id]);

        res.redirect("/modify");

    } catch (err) {
        console.log(err);
    }
});

app.post("/read", async (req, res) => {
    try {
        if (req.body.sortTitle || req.body.sortTitleModif) {
            await getBookNotes("ORDER BY title ASC");
        } else if (req.body.sortDate || req.body.sortDateModif) {
            await getBookNotes("ORDER BY read_date DESC");
        } else if (req.body.sortRating || req.body.sortRatingModif) {
            await getBookNotes("ORDER BY rating DESC");
        } else {
            const search = {
                title: req.body.title,
                author: req.body.author
            };
            let query = "SELECT books.id id, title, author, books.cover_id, TO_CHAR(read_date, 'YYYY-MM-DD') read_date, summary, rating, notes, TO_CHAR(update_date, 'YYYY-MM-DD') update_date FROM books JOIN summary ON summary.book_id = books.id JOIN notes ON notes.book_id = books.id";
            const values = [];
    
            if (search.title || search.author) {
                query += " WHERE ";
                if (search.title) {
                    query += "LOWER(title) LIKE '%' || LOWER($1) || '%'";
                    values.push(search.title.toLowerCase());
                }
                if (search.title && search.author) {
                    query += " OR ";
                }
                if (search.author) {
                    query += "LOWER(author) LIKE '%' || LOWER($" + (values.length + 1) + ") || '%'";
                    values.push(search.author.toLowerCase());
                }
            } else {
                res.redirect("/");
                return;
            }
    
            const searchResult = await db.query(query, values);
    
            bookNotes = searchResult.rows;    
        }


        if (req.body.read) {
            res.render("bookList.ejs", {
                email: email, 
                books: bookNotes
            }); 
        } else if (req.body.readModification) {
            res.render("modify.ejs", {
                books: bookNotes
            });
        } else if (req.body.sortTitle || req.body.sortDate || req.body.sortRating) {
            res.render("bookList.ejs", {
                email: email, 
                books: bookNotes
            });
        } else if (req.body.sortTitleModif || req.body.sortDateModif || req.body.sortRatingModif) {
            res.render("modify.ejs", {
                books: bookNotes
            });
        }
        

    } catch (err) {
        console.log(err);
    }
});

app.listen(port, () => {
    console.log(`Local host is running on port ${port}`);
});