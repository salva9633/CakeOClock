const express = require("express");
const router = express.Router();
const passport = require("passport");
const {
  loadProductsPage
} = require("../controllers/user/productController");

const {
  loadProductDetailsPage,
  getVariantDetails
} = require("../controllers/user/productDetailsController");

const userController = require("../controllers/user/userController");
const profileController = require("../controllers/user/profileController"); 
const { userAuth, userNotLoggedIn } = require("../middlewares/auth");
const upload = require("../middlewares/multer");

const { loadNearExpiryDeals } =
  require("../controllers/user/expiryDealsController");

  
  
  router.get("/", userController.loadHomePage);

  router.get("/logout", userController.logout);
  
  router.get("/signUp", userController.signuppage);
  router.post("/signUp", userController.createUser);

  router.get("/login", userNotLoggedIn, userController.loadlogin);
router.post("/login", userController.loginUser);

router.get("/verify-otp", userController.verifyOtpPage);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);

router.get("/profile", userAuth, profileController.userProfile);
router.get("/editProfile", userAuth, profileController.editProfileLoad);
router.post(
  "/editProfile",
  userAuth,
  upload.single("profileImage"),
  profileController.editProfilePost
);


router.get(
  "/verifyEmailOtp",
  userAuth,
  profileController.verifyEmailOtpPage
);

router.post(
  "/verifyEmailOtp",
  userAuth,
  profileController.verifyEmailOtp
);



router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    if (req.user.isBlocked) {
      return res.redirect("/login");
    }

    req.session.user = {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone
    };
    res.redirect("/");
  }
);


router.get("/products", loadProductsPage);


router.get("/product/:id", loadProductDetailsPage);
router.get("/variant/:variantId", getVariantDetails);
router.get("/near-expiry", loadNearExpiryDeals);

// Address management
router.get("/profile/address", userAuth, profileController.addressPage);
router.get("/add-address", userAuth, (req, res) => {
  res.render("add-address");
});
router.get("/address", userAuth, profileController.addressPage);

router.post("/add-address", userAuth, profileController.addAddress);
router.get("/address/delete/:id", userAuth, profileController.deleteAddress);
router.get("/address/edit/:id", userAuth, profileController.editAddressPage);
router.post("/address/edit/:id", userAuth, profileController.updateAddress);

// Change password
router.get("/changePassword", userAuth, profileController.loadChangePassword);
router.post("/changePassword", userAuth, profileController.changePassword);
router.post("/checkCurrentPassword",userAuth, profileController.checkCurrentPassword);



// Forgot password
router.get("/forgotPassword", userController.forgotPasswordPage);
router.post("/forgotPassword", userController.sendForgotOtp);

router.get("/verifyOTP", userController.verifyForgotOtpPage);
router.post("/verifyOTP", userController.verifyForgotOtp);

router.get("/resetPassword", userController.resetPasswordPage);
router.post("/update-password", userController.updatePassword);



module.exports = router;
