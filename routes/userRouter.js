const express = require("express");
const router = express.Router();
const passport = require("passport");

const userController = require("../controllers/user/userController");
const profileController = require("../controllers/user/profileController"); 
const { userAuth } = require("../middlewares/auth");
const upload = require("../middlewares/multer");

router.get("/", userController.loadHomepage);
router.get("/logout", userController.logout);

router.get("/signUp", userController.signuppage);
router.post("/signUp", userController.createUser);

router.get("/login", userController.loadlogin);
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
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    req.session.user = {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone:req.user.phone
    };
    res.redirect("/");
  }
);



module.exports = router;
