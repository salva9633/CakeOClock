const express = require("express");
const app = express();
require("dotenv").config();

const session = require("express-session");
const passport = require("./config/passport");
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const path = require("path");

db();

// session middleware (MUST be first)
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 24 * 60 * 60 * 1000
        }
    })
);

// passport middleware
app.use(passport.initialize());
app.use(passport.session());

// body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// set locals BEFORE routes ✅
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.admin = req.session.admin || null;
    next();
});

// view engine
app.set("view engine", "ejs");
app.set("views", [
    path.join(__dirname, "views/admin"),
    path.join(__dirname, "views/user")
]);

// static files
app.use(express.static(path.join(__dirname, "public")));

// routes
app.use("/", userRouter);
app.use("/admin", adminRouter);

// 404 handler (LAST)
app.use((req, res) => {
    res.status(404).render("pagenotfound");
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
