import express from "express";
import expressLayouts from "express-ejs-layouts";
import { customerInfo, blockUser, unblockUser } from "../controllers/admin/customerController.js";
import { categoryInfo, toggleCategoryStatus, deleteCategory, editCategory, addCategory } from "../controllers/admin/categoryController.js";
import upload from "../middlewares/multer.js";
import { adminAuth } from "../middlewares/auth.js";
import productRoutes from "./admin/productRoutes.js";
import variantRoutes from "./admin/variantRoutes.js";
import batchRoutes from "./admin/batchRoutes.js";
import { loadLogin, login, loadDashboard, pageerror, logout } from "../controllers/admin/adminController.js";
import {
  loadOrders,
  loadOrderDetail,
  updateOrderStatus,
  updateItemStatus,   
  pollOrderStatus,    
} from '../controllers/admin/orderController.js';
const router = express.Router();

router.use(expressLayouts);
router.use((req, res, next) => {
  res.locals.layout = "layout";
  return next();
});

// ── AUTH (no guard needed) ────────────────────────────────
router.get("/login",  loadLogin);
router.post("/login", login);

// ── ERROR PAGE (no guard) ─────────────────────────────────
router.get("/pageerror", pageerror);        // ✅ was "pagenotfound" — fixed name

// ── PROTECTED ROUTES ─────────────────────────────────────
router.get("/",       adminAuth, loadDashboard);
router.get("/logout", adminAuth, logout);   // ✅ added adminAuth guard

/* USERS */
router.get("/users",           adminAuth, customerInfo);
router.get("/block-user/:id",  adminAuth, blockUser);
router.get("/unblock-user/:id",adminAuth, unblockUser);

/* CATEGORY */
router.get("/category",                   adminAuth, categoryInfo);
router.patch("/category/status/:id",      adminAuth, toggleCategoryStatus);
router.delete("/category/delete/:id",     adminAuth, deleteCategory);
router.patch("/category/edit/:id",        adminAuth, upload.single("image"), editCategory);
router.post("/category/add",              adminAuth, upload.single("image"), addCategory);

/* PRODUCTS */
router.use("/products", adminAuth, productRoutes);

/* VARIANTS */
router.use("/variants", adminAuth, variantRoutes);

/* BATCHES */
router.use("/batches",  adminAuth, batchRoutes);

/* ORDERS */
router.get("/orders",                          adminAuth, loadOrders);
router.get("/orders/:id",                      adminAuth, loadOrderDetail);
router.patch("/orders/:id/status",             adminAuth, updateOrderStatus);
router.patch("/orders/:id/item/:itemId/status",adminAuth, updateItemStatus);
router.get('/orders/:id/poll-status', adminAuth, pollOrderStatus);

export default router;