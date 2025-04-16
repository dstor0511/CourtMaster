-- This makes sure that foreign_key constraints are observed and that errors will be thrown for violations
PRAGMA foreign_keys=ON;

BEGIN TRANSACTION;

--create your tables with SQL commands here (watch out for slight syntactical differences with SQLite)


-- This table is used to store the user login information
CREATE TABLE IF NOT EXISTS userLoginInfo (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT UNIQUE NOT NULL,
    user_password TEXT NOT NULL,
    user_name TEXT NOT NULL
);

-- This table is used to store the tennis class information.
CREATE TABLE IF NOT EXISTS TennisClass (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TIMESTAMP NOT NULL,
    publicationDate TIMESTAMP NOT NULL,
    isPublished BOOLEAN NOT NULL,
    lastModified TIMESTAMP NOT NULL,
    likes INTEGER NOT NULL,
    bookings INTEGER DEFAULT 0,
    maxBookings INTEGER NOT NULL
);

-- This table is used to store the comments for each tennis class, if there are any.
CREATE TABLE IF NOT EXISTS Comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comments TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    lastModified TEXT NOT NULL,
    ArticleId INTEGER NOT NULL,
    UserId INTEGER NOT NULL,
    FOREIGN KEY (ArticleId) REFERENCES TennisClass(id) ON DELETE CASCADE,
    FOREIGN KEY (UserId) REFERENCES userLoginInfo(user_id)
);

-- This table is used to store the tile, subtitle, and author of CourtMaster.
CREATE TABLE IF NOT EXISTS CourtMaster (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    Title TEXT NOT NULL,
    Subtitle TEXT NOT NULL,
    author TEXT NOT NULL
);

-- This table is used to store the bookings for each tennis class.
CREATE TABLE IF NOT EXISTS Bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ArticleId INTEGER NOT NULL,
    UserId INTEGER NOT NULL,
    FOREIGN KEY (ArticleId) REFERENCES TennisClass(id) ON DELETE CASCADE,
    FOREIGN KEY (UserId) REFERENCES userLoginInfo(user_id)
);

--insert default data (if necessary here)

COMMIT;

