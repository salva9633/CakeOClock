import express from "express";
import passport from "passport";
 
import { loadProductsPage } from "../controllers/user/productController.js";
import { loadProductDetailsPage, getVariantDetails } from "../controllers/user/productDetailsController.js";
import * as userController from "../controllers/user/userController.js";
import * as profileController from "../controllers/user/profileController.js";
import { userAuth, userNotLoggedIn } from "../middlewares/auth.js";
import upload from "../middlewares/multer.js";
import { loadNearExpiryDeals } from "../controllers/user/expiryDealsController.js";
import { addReview, getReviews } from "../controllers/user/reviewController.js";
import { toggleWishlist, getWishlist } from "../controllers/user/wishlistController.js";
import { addToCart, getCart, updateCartItem, removeCartItem, getVariantsByProduct } from "../controllers/user/cartController.js";
import { loadCheckout, loadPaymentPage, placeOrder, orderSuccess } from "../controllers/user/checkoutController.js";
import { listOrders, orderDetail, cancelOrder, cancelOrderItem, returnOrder, downloadInvoice ,getOrderStatus } from "../controllers/user/orderController.js";
 
const router = express.Router();
 
// ── AUTH ──────────────────────────────────────────────
router.get("/signUp", userController.signuppage);
router.post("/signUp", userController.createUser);
 
router.get("/login", userNotLoggedIn, userController.loadlogin);
router.post("/login", userController.loginUser);
router.get("/logout", userController.logout);
 
router.get("/verify-otp", userController.verifyOtpPage);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
 
// ── GOOGLE OAuth ──────────────────────────────────────
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    if (req.user.isBlocked) return res.redirect("/login");
    req.session.user = {
      id:    req.user._id,
      name:  req.user.name,
      email: req.user.email,
      phone: req.user.phone,
    };
    res.redirect("/");
  }
);
 
// ── FORGOT PASSWORD ───────────────────────────────────
router.get("/forgotPassword",   userController.forgotPasswordPage);
router.post("/forgotPassword",  userController.sendForgotOtp);
router.get("/verifyOTP",        userController.verifyForgotOtpPage);
router.post("/verifyOTP",       userController.verifyForgotOtp);
router.get("/resetPassword",    userController.resetPasswordPage);
router.post("/update-password", userController.updatePassword);
 
// ── HOME ──────────────────────────────────────────────
router.get("/", userController.loadHomePage);
 
// ── PRODUCTS ──────────────────────────────────────────
router.get("/products",           loadProductsPage);
router.get("/product/:id",        loadProductDetailsPage);
router.get("/variant/:variantId", getVariantDetails);
router.get("/near-expiry",        loadNearExpiryDeals);
 
// ── REVIEWS ───────────────────────────────────────────
router.post("/add-review",         userAuth, addReview);
router.get("/reviews/:productId",  getReviews);
 
// ── PROFILE ───────────────────────────────────────────
router.get("/profile",      userAuth, profileController.userProfile);
router.get("/editProfile",  userAuth, profileController.editProfileLoad);
router.post("/editProfile", userAuth, upload.single("profileImage"), profileController.editProfilePost);
 
router.get("/verifyEmailOtp",  userAuth, profileController.verifyEmailOtpPage);
router.post("/verifyEmailOtp", userAuth, profileController.verifyEmailOtp);
 
// ── CHANGE PASSWORD ───────────────────────────────────
router.get("/changePassword",        userAuth, profileController.loadChangePassword);
router.post("/changePassword",       userAuth, profileController.changePassword);
router.post("/checkCurrentPassword", userAuth, profileController.checkCurrentPassword);
 
// ── ADDRESS ───────────────────────────────────────────
router.get("/profile/address",    userAuth, profileController.addressPage);
router.get("/address",            userAuth, profileController.addressPage);
router.get("/add-address",        userAuth, (req, res) => res.render("add-address", { from: req.query.from || "" }));
router.post("/add-address",       userAuth, profileController.addAddress);
router.get("/address/delete/:id", userAuth, profileController.deleteAddress);
router.get("/address/edit/:id",   userAuth, profileController.editAddressPage);
router.post("/address/edit/:id",  userAuth, profileController.updateAddress);
 
// ── WISHLIST ──────────────────────────────────────────
router.get("/wishlist",         userAuth, getWishlist);
router.post("/wishlist/toggle", userAuth, toggleWishlist);
 
// ── CART ──────────────────────────────────────────────
router.get("/cart",          userAuth, getCart);
router.post("/cart/add",     userAuth, addToCart);
router.post("/cart/update",  userAuth, updateCartItem);
router.post("/cart/remove",  userAuth, removeCartItem);
router.get("/variant/by-product/:productId", getVariantsByProduct);
 
// ── CHECKOUT ──────────────────────────────────────────
router.get("/checkout",              userAuth, loadCheckout);
router.get("/payment-page",          userAuth, loadPaymentPage);
router.post("/checkout/place",       userAuth, placeOrder);
router.get("/order-success/:id",     userAuth, orderSuccess);
 
// ── ORDERS ────────────────────────────────────────────
router.get("/orders",                userAuth, listOrders);
router.post("/orders/item/cancel",   userAuth, cancelOrderItem);
router.get("/orders/:id",            userAuth, orderDetail);
router.post("/orders/:id/cancel",    userAuth, cancelOrder);
router.post("/orders/:id/return",    userAuth, returnOrder);
router.get("/orders/:id/invoice",    userAuth, downloadInvoice);
router.get('/orders/:id/status', userAuth, getOrderStatus);
router.get('/api/check-session', (req, res) => {
  res.json({ loggedIn: !!req.session?.user });
});
export default router;
 