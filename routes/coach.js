const express = require("express");
const router = express.Router();
const authorEmail = "coach@courtmaster.com"; // hard coded 'coach' email instead of making roles as there is only 1 author.
// This user needs to be created as the author in the database

// check if the user is an author
function checkAuthorAccess(req, res, next) {
    if (req.session.user && req.session.user.email === authorEmail) {
        next();
    } else {
        res.redirect("/login");
    }
}

//  =========================================================
//  ===================== Coach Home =======================
//  =========================================================

// Coach Home. This page displays all the tennis classes created by the coach. Also, the coach can see the published and draft classes.
router.get("/", checkAuthorAccess, (req, res) => {
    let classQuery = "SELECT * FROM TennisClass ORDER BY title";

    // Get the site title, subtitle and author name
    let organizerQuery = `
        SELECT CourtMaster.Title AS siteTitle, CourtMaster.Subtitle AS siteSubtitle, CourtMaster.author AS authorName
        FROM CourtMaster
        WHERE CourtMaster.id = 1
    `;

    // Get all the tennis classes created by the coach and render the coach home page
    db.all(classQuery, [], (err, tennisClasses) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Internal Server Error");
        }

        const publishedClasses = tennisClasses.filter(
            (tennisClass) => tennisClass.isPublished
        );
        const draftClasses = tennisClasses.filter(
            (tennisClass) => !tennisClass.isPublished
        );

        db.get(organizerQuery, [], (err, organizer) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Internal Server Error");
            }

            if (!organizer) {
                organizer = ["", "", ""];
            }

            res.render("coachHome", {
                organizer: organizer,
                tennisClasses: tennisClasses,
                publishedClasses: publishedClasses,
                draftClasses: draftClasses,
            });
        });
    });
});

//  =========================================================
//  ==================== Coach Setting =====================
//  =========================================================

// Coach Setting. This page allows the coach to update the title and subtitle.
router.get("/setting", checkAuthorAccess, (req, res) => {
    const query = `
        SELECT CourtMaster.Title AS siteTitle, CourtMaster.Subtitle AS siteSubtitle, CourtMaster.author AS authorName
        FROM CourtMaster
        WHERE CourtMaster.id = 1
    `;

    db.get(query, (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Internal Server Error");
        }

        // Check if CourtMaster exist, if not return empty place holders
        if (!row) {
            row = ["", ""];
        }

        // Render the coach settings page
        const { siteTitle, siteSubtitle } = row;
        res.render("coachSettings", { siteTitle, siteSubtitle });
    });
});

// Update the site title and subtitle
router.post("/setting/update", checkAuthorAccess, (req, res) => {
    const { siteTitle, siteSubtitle } = req.body;
    const authorName = req.session.user.name;
    let query = `
        UPDATE CourtMaster
        SET Title = ?, Subtitle = ?, author = ?
        WHERE id = 1
    `;

    // Update the site title and subtitle
    db.run(query, [siteTitle, siteSubtitle, authorName], function (err) {
        if (err) {
            console.error(err);
            return res.status(500).send("Internal Server Error");
        }

        if (this.changes === 0) {
            query = `
                INSERT INTO CourtMaster (id, Title, Subtitle, author)
                VALUES (?, ?, ?, ?)
            `;

            db.run(
                query,
                [1, siteTitle, siteSubtitle, authorName],
                function (err) {
                    if (err) {
                        console.error(err);
                        return res.status(500).send("Internal Server Error");
                    }

                    res.redirect("/coach");
                }
            );
        } else {
            res.redirect("/coach");
        }
    });
});

//  =========================================================
//  ==================== Coach Class =====================
//  =========================================================

// Coach Class. This page allows the coach to create a new tennis class or edit an existing one.
// 1. If the articleId is provided, then the coach is editing an existing tennis class. Here
// the coach can update the title, subtitle, content and max bookings. Render the coach class page with the existing tennis class details.
router.get("/tennis_class/:articleId?", checkAuthorAccess, (req, res) => {
    const articleId = req.params.articleId;
    const loggedInAuthorName = req.session.user.name;

    if (articleId) {
        db.get(
            "SELECT * FROM TennisClass WHERE id = ? AND author = ?",
            [articleId, loggedInAuthorName],
            (err, row) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send("Internal Server Error");
                }

                if (!row) {
                    return res.status(404).send("Article not found");
                }

                res.render("coachClass", {
                    articleId: row.id,
                    articleTitle: row.title,
                    articleSubtitle: row.subtitle,
                    articleText: row.content,
                    articleAuthor: row.author,
                    articleCreation: row.createdAt,
                    maxBookings: row.maxBookings,
                });
            }
        );
    } else {
        res.render("coachClass", {
            articleId: null,
            articleTitle: "",
            articleSubtitle: "",
            articleText: "",
            articleAuthor: loggedInAuthorName,
            articleCreation: new Date(),
            maxBookings: 0,
        });
    }
});

// 2. Publish the tennis class. If the tennis class is already created, then update the title, subtitle,
// content, last modified date, isPublished, likes, publication date and max bookings. If the tennis class is new,
// then insert a new tennis class with the given details. Redirect to the coach home page.
router.post("/publish", checkAuthorAccess, (req, res) => {
    const tennisClass = req.body.tennisClass;
    const author = req.session.user.name;
    const maxBookings = req.body.maxBookings;
    if (tennisClass) {
        const fetchSql =
            "SELECT title, subtitle, content, author FROM TennisClass WHERE id = ?";
        db.get(fetchSql, [tennisClass], (err, row) => {
            if (err) {
                return console.error(err.message);
            }

            if (row) {
                const data = [
                    row.title,
                    row.subtitle,
                    row.author,
                    row.content,
                    new Date(),
                    1,
                    0,
                    new Date(),
                    maxBookings,
                ];

                const updateSql =
                    "UPDATE TennisClass SET title = ?, subtitle = ?, author = ?, content = ?, lastModified = ?, isPublished = ?, likes = ?, publicationDate = ?, maxBookings = ? WHERE id = ?";
                data.push(tennisClass);
                db.run(updateSql, data, function (err) {
                    if (err) {
                        console.log("Error updating tennis class");
                        return console.error(err.message);
                    }
                    console.log(
                        `Tennis class with id ${tennisClass} has been published`
                    );
                    res.redirect("/coach");
                });
            } else {
                console.error(`Article with id ${tennisClass} not found`);
                res.redirect("/coach");
            }
        });
    } else {
        const data = [
            req.body.articleTitle,
            req.body.articleSubtitle,
            author,
            req.body.articleText,
            new Date(),
            new Date(),
            1,
            0,
            new Date(),
            maxBookings,
        ];

        const insertSql =
            "INSERT INTO TennisClass (title, subtitle, author, content, createdAt, lastModified, isPublished, likes, publicationDate, maxBookings) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        db.run(insertSql, data, function (err) {
            if (err) {
                console.log("Error inserting new tennis class");
                return console.error(err.message);
            }
            console.log(
                `New tennis class has been published with id ${this.lastID}`
            );
            res.redirect("/coach");
        });
    }
});

// 3. SQL query to delete the tennis class with the given id.
router.post("/delete", checkAuthorAccess, (req, res) => {
    const data = [req.body.tennisClassId];

    db.run("DELETE FROM TennisClass WHERE id = ?", data, (err) => {
        if (err) {
            console.error(err.message);
            res.status(500).send("Error deleting article");
        } else {
            console.log(`Tennis class with id ${data[0]} has been deleted`);
            res.redirect("/coach");
        }
    });
});

// 4. Save the tennis class as draft. If the tennis class is already created, then update the title, subtitle,
// content, last modified date, isPublished, likes, publication date and max bookings. If the tennis class is new,
// then insert a new tennis class with the given details. Redirect to the coach home page.
router.post("/saveasdraft", checkAuthorAccess, (req, res) => {
    const articleId = req.body.articleId;
    const author = req.session.user.name;

    if (articleId) {
        const data = [
            req.body.articleTitle,
            req.body.articleSubtitle,
            author,
            req.body.articleText,
            new Date(),
            0,
            0,
            0,
            req.body.maxBookings,
        ];

        const updateSql =
            "UPDATE TennisClass SET title = ?, subtitle = ?, author = ?, content = ?, lastModified = ?, isPublished = ?, likes = ?, publicationDate = ?, maxBookings = ? WHERE id = ?";
        data.push(articleId);
        db.run(updateSql, data, function (err) {
            if (err) {
                return console.error(err.message);
            }
            console.log(
                `Tennis class with id ${articleId} has been saved as draft`
            );
            res.redirect("/coach");
        });
    } else {
        const data = [
            req.body.articleTitle,
            req.body.articleSubtitle,
            author,
            req.body.articleText,
            new Date(),
            new Date(),
            0,
            0,
            0,
            req.body.maxBookings,
        ];

        const insertSql =
            "INSERT INTO TennisClass (title, subtitle, author, content, createdAt, lastModified, isPublished, likes, publicationDate, maxBookings) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        db.run(insertSql, data, function (err) {
            if (err) {
                return console.error(err.message);
            }
            console.log(
                `New tennis class has been saved as draft with id ${this.lastID}`
            );
            res.redirect("/coach");
        });
    }
});

module.exports = router;
