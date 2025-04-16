// Import necessary modules
const express = require("express");
const app = express();
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const session = require("express-session");
const Joi = require("joi"); // Import Joi

// Initialize the database connection
global.db = new sqlite3.Database("./database.db", function (err) {
    if (err) {
        console.error(err);
        process.exit(1);
    } else {
        console.log("Database connected");
        global.db.run("PRAGMA foreign_keys=ON");
    }
});

//  =========================================================
//  ================ App Config / Middleware ================
//  =========================================================

// Set the view engine to ejs, and set the public folder to serve static files
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));

// Generate a secret key for the session using the current timestamp and a random string
const generateSecretKey = () => {
    const timestamp = Date.now().toString(36); // Convert current timestamp to base36
    const randomString = Math.random().toString(36).slice(2); // Generate a random base36 string
    const secret = timestamp + randomString; // Combine the timestamp and random string
    return secret;
};

// Generate a secret key for the session
const secretKey = generateSecretKey();

// Initialize the session middleware, this session middleware will store the session data in memory
app.use(
    session({
        secret: secretKey,
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false },
    })
);

// Middleware to set the user's email and name in res.locals
app.use((req, res, next) => {
    res.locals.userEmail = req.session.user ? req.session.user.email : "";
    res.locals.userName = req.session.user ? req.session.user.name : "";
    next();
});

// Check if the user is logged in
function isEmailRegistered(email) {
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT user_id FROM userLoginInfo WHERE LOWER(user_email) = ?",
            [email.toLowerCase()],
            (err, row) => {
                if (err) {
                    return reject("Internal server error");
                }
                // If row is not null, email is already registered
                const emailExists = !!row;
                resolve(emailExists);
            }
        );
    });
}

//  =========================================================
//  ===================== Coach & Student =================
//  =========================================================

// Define the routes for the student and coach
const studentRouter = require("./routes/student");
const coachRouter = require("./routes/coach");

// Use the routes for each profile
app.use("/student", studentRouter);
app.use("/coach", coachRouter);

//  =========================================================
//  ======================== LOGIN ==========================
//  =========================================================

// Define the login schema using Joi
const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
});

// Define the login route
app.get("/login", (req, res) => {
    res.render("login");
});

// Handle the login form submission. This route will be called when the user submits the login form
// The route will validate the form data using the loginSchema, then check if the email exists in the database
// If the email exists, it will compare the password using bcrypt. Finally, it will set the user session
app.post("/login", (req, res) => {
    const { error } = loginSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = req.body;

    db.get(
        "SELECT * FROM userLoginInfo WHERE user_email = ?",
        [email],
        (err, row) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Internal Server Error" });
            }

            if (!row) {
                return res.status(401).json({ error: "Invalid credentials" });
            }

            bcrypt.compare(password, row.user_password, (err, result) => {
                if (err) {
                    console.error(err);
                    return res
                        .status(500)
                        .json({ error: "Internal Server Error" });
                }

                if (!result) {
                    return res
                        .status(401)
                        .json({ error: "Invalid credentials" });
                }

                req.session.user = {
                    id: row.user_id,
                    email: row.user_email,
                    name: row.user_name,
                };

                return res.status(200).json({ message: "Login successful" });
            });
        }
    );
});

//  =========================================================
//  ====================== REGISTER =========================
//  =========================================================

// Define the register schema using Joi
const registerSchema = Joi.object({
    name: Joi.string().min(8).required(),
    email: Joi.string().email().required(),
    confirmemail: Joi.string().email().required().valid(Joi.ref("email")),
    password: Joi.string().min(6).required(),
    confirmpassword: Joi.string().required().valid(Joi.ref("password")),
});

// Define the register route
app.get("/register", (req, res) => {
    res.render("register");
});

// Handle the register form submission. This route will be called when the user submits the register form
// The route will validate the form data using the registerSchema, then check if the email is already registered
// If the email is not registered, it will hash the password using bcrypt and insert the user into the database

app.post("/register", async (req, res) => {
    const { error } = registerSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    const { name, email, password } = req.body;

    try {
        const emailExists = await isEmailRegistered(email);
        if (emailExists) {
            return res.status(400).json({ error: "Email already registered" });
        }

        // Hash the password using bcrypt
        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Internal Server Error" });
            }

            db.run(
                "INSERT INTO userLoginInfo (user_name, user_email, user_password) VALUES (?, ?, ?)",
                [name, email, hashedPassword],
                (err) => {
                    if (err) {
                        console.error(err);
                        return res
                            .status(500)
                            .json({ error: "Internal Server Error" });
                    }
                    return res
                        .status(201)
                        .json({ message: "User registered successfully" });
                }
            );
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

//  =========================================================
//  ======================== LOGOUT =========================
//  =========================================================

// Define the logout route and destroy the session
app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
        }
        res.redirect("/");
    });
});

//  =========================================================
//  ======================== INDEX ==========================
//  =========================================================

// Define the index route
app.get("/", (req, res) => {
    if (req.session.user) {
        if (req.session.user.email === "coach@courtmaster.com") {
            return res.redirect("/coach");
        } else {
            return res.redirect("/student");
        }
    }
    res.render("index");
});

//  =========================================================
//  ================= Redirect nonexistent ==================
//  =========================================================

// Redirect nonexistent routes to the 404 page
app.get("*", (req, res) => {
    res.status(404).render("404");
});

//  =========================================================
//  ==================== Export Module ======================
//  =========================================================

// Export the app module
const port = 3000;

// Start the server
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
