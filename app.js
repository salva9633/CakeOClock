import express from "express";
import dotenv from "dotenv";
import session from "express-session";
import MongoStore from "connect-mongo";
import passport from "./config/passport.js";
import { injectBadgeCounts } from "./middlewares/badgeCounts.js";
import db from "./config/db.js";
import userRouter from "./routes/userRouter.js";
import adminRouter from "./routes/adminRouter.js";
import path from "path";
import { fileURLToPath } from "url";
import morgan from "morgan";
import logger from "./utils/logger.js";
 
dotenv.config();
 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
 
const app = express();
db();
 
// ── 1. LOGGING ────────────────────────────────────────────
app.use(morgan("dev", {
  stream: { write: (message) => logger.info(message.trim()) },
}));
 
// ── 2. BODY PARSING ───────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
 
// ── 3. VIEW ENGINE ────────────────────────────────────────
app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/admin"),
  path.join(__dirname, "views/user"),
]);
 
// ── 4. STATIC FILES ───────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));
 
// ── 5. CACHE CONTROL ──────────────────────────────────────
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  return next();
});
 
// ── 6. DEFAULT LOCALS ─────────────────────────────────────
app.use((req, res, next) => {
  res.locals.user  = null;
  res.locals.admin = null;
  return next();
});
 
// ── 7. SEPARATE SESSIONS ──────────────────────────────────
const userSession = session({
  name: "user_sid",
  secret: process.env.USER_SESSION_SECRET || "user_secret",
  resave: false,
  saveUninitialized: false,
  rolling: false,
  unset: "destroy",
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: "user_sessions",
    ttl: 24 * 60 * 60,
    autoRemove: "native",
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  },
});
 
const adminSession = session({
  name: "admin_sid",
  secret: process.env.ADMIN_SESSION_SECRET || "admin_secret",
  resave: false,
  saveUninitialized: false,
  rolling: false,
  unset: "destroy",
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: "admin_sessions",
    ttl: 2 * 60 * 60,
    autoRemove: "native",
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  },
});
 
// ── 8. ROUTES WITH SESSIONS INJECTED ─────────────────────
app.use("/admin", adminSession, (req, res, next) => {
  res.locals.admin = req.session.admin || null;
  return next();
}, passport.initialize(), passport.session(), injectBadgeCounts, adminRouter);
 
app.use("/", userSession, (req, res, next) => {
  res.locals.user = req.session.user || null;
  return next();
}, passport.initialize(), passport.session(), injectBadgeCounts, userRouter);
 
// ── 9. 404 ────────────────────────────────────────────────
app.use((req, res) => {
  logger.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
  return res.status(404).render("pagenotfound");
});
 
// ── 10. GLOBAL ERROR HANDLER ──────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl}`);
  return res.status(500).send("Something went wrong");
});
 
// ── 11. SERVER ────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));