const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

// check if the user is logged in
function checkUserAccess(req, res, next) {
    if (req.session.user != "") {
        next();
    } else {
        res.redirect("/login");
    }
}

/*
Student Home
*/

// GET request to display the home page for the student. This page will display all the tennis classes that are published.
router.get("/", (req, res) => {
    let sql =
        "SELECT * FROM TennisClass WHERE isPublished = 1 ORDER BY publicationDate DESC";
    let tennisClass = [];

    db.all(sql, [], (err, rows) => {
        if (err) {
            throw err;
        }
        tennisClass = rows;

        res.render("studentHome", { tennisClass: tennisClass });
    });
});

/*
Student Class
*/

// GET request to display the article page for the student. This page will display the details of the tennis class.
// It will also display the comments that are made by the users.
router.get("/tennis_class/:id", checkUserAccess, (req, res) => {
    const _articleId = req.params.id;
    const sqlArticle = "SELECT * FROM TennisClass WHERE id = ?";
    const sqlComments = `SELECT Comments.*, userLoginInfo.user_name AS username FROM Comments JOIN userLoginInfo ON Comments.UserId = userLoginInfo.user_id WHERE ArticleId = ? ORDER BY createdAt DESC`;
    const sqlBookings = `SELECT * FROM Bookings WHERE ArticleId = ? AND UserId = ?`;

    let _userId = null;
    if (req.session.user) {
        _userId = req.session.user.id;
    }

    db.get(sqlArticle, [_articleId], (err, row) => {
        if (err) {
            return console.error(err.message);
        }

        if (row) {
            row.articleCreation = `This tennis class was created on ${new Date(
                row.createdAt
            ).toLocaleDateString()}`;
            row.bookings = row.bookings || 0;
            row.maxBookings = row.maxBookings || 0;

            db.all(sqlComments, [_articleId], (err, comments) => {
                if (err) {
                    console.log("error");
                    return console.error(err.message);
                }

                if (_userId) {
                    db.get(
                        sqlBookings,
                        [_articleId, _userId],
                        function (err, booking) {
                            if (err) {
                                console.log("error");
                                return console.error(err.message);
                            }
                            res.render("studentClass", {
                                tennisClass: row,
                                comments,
                                userHasBooked: booking != null,
                            });
                        }
                    );
                } else {
                    res.render("studentClass", {
                        tennisClass: row,
                        comments,
                        userHasBooked: false,
                    });
                }
            });
        } else {
            res.redirect("/student");
        }
    });
});

// 2. POST request to book a tennis class. This request will add a booking to the tennis class.
router.post("/tennis_class/:id/book", checkUserAccess, (req, res) => {
    const _userId = req.session.user.id;
    if (_userId) {
        const sqlExists = `SELECT * FROM Bookings WHERE ArticleId = ? AND UserId = ?`;
        const sqlInsert = `INSERT INTO Bookings (ArticleId, UserId) VALUES (?, ?)`;
        const sqlDelete = `DELETE FROM Bookings WHERE ArticleId = ? AND UserId = ?`;

        db.get(sqlExists, [req.params.id, _userId], (err, row) => {
            if (err) {
                console.log("error");
                return console.error(err.message);
            }

            if (row) {
                db.run(sqlDelete, [req.params.id, _userId], (err) => {
                    if (err) {
                        console.log("error");
                        return console.error(err.message);
                    }

                    const sql = `UPDATE TennisClass SET bookings = bookings - 1 WHERE id = ?`;
                    db.run(sql, [req.params.id], (err) => {
                        if (err) {
                            console.log("error");
                            return console.error(err.message);
                        }
                        res.json({ booked: false });
                    });
                });
            } else {
                db.run(sqlInsert, [req.params.id, _userId], (err) => {
                    if (err) {
                        console.log("error");
                        return console.error(err.message);
                    }

                    const sql = `UPDATE TennisClass SET bookings = bookings + 1 WHERE id = ?`;
                    db.run(sql, [req.params.id], (err) => {
                        if (err) {
                            console.log("error");
                            return console.error(err.message);
                        }
                        res.json({ booked: true });
                    });
                });
            }
        });
    } else {
        res.sendStatus(401);
    }
});

// 3. POST request to add a comment to a tennis class. This request will add a comment to the tennis class, it will
// be associated with the user that is logged in, and visible to all users.
router.post("/tennis_class/:id/comment", checkUserAccess, (req, res) => {
    const sqlUser = "SELECT * FROM userLoginInfo WHERE user_name = ?";
    db.get(sqlUser, req.session.user.name, (err, user) => {
        if (err) {
            return console.error(err.message);
        }
        if (user) {
            const sqlComment =
                "INSERT INTO Comments (comments, createdAt, lastModified, ArticleId, UserId) VALUES (?, ?, ?, ?, ?)";
            const comment = req.body.commentInput;
            const now = new Date().toISOString();
            db.run(
                sqlComment,
                [comment, now, now, req.params.id, user.user_id],
                (err) => {
                    if (err) {
                        return console.error(err.message);
                    }
                    res.redirect("/student/tennis_class/" + req.params.id);
                }
            );
        } else {
            res.redirect("/login");
        }
    });
});

module.exports = router;
