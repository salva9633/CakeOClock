const express = require("express");
const router = express.Router();
const passport = require("passport"); 
const userController = require("../controllers/userController");


router.get("/", userController.loadHomepage);
router.get("/logout",userController.logout);

router.get("/signUp", userController.signuppage);
router.post("/signUp", userController.createUser);

router.get("/login", userController.loadlogin);
router.post("/login", userController.loginUser);

router.get("/verify-otp", userController.verifyOtpPage);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);

router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/auth/google/callback",passport.authenticate("google", { failureRedirect: "/signUp" }),
  (req, res) => {
    res.redirect("/"); 
  }
);

module.exports = router;
