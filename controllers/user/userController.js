const User = require("../../models/userModel");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const { sendVerificationEmail } = require("../../utils/email");
const Batch = require("../../models/batchModel");
const Category = require("../../models/categoryModel");

// ─────────────────────────────────────────
// HOME PAGE
// ─────────────────────────────────────────
const loadHomePage = async (req, res) => {
  try {
    let userData = null;
    if (req.session.user) {
      userData = await User.findById(req.session.user.id).lean();
    }

    const categories = await Category.find({
      isDeleted: false,
      isActive: true
    })
      .sort({ createdAt: -1 })
      .lean();

      

    const today = new Date();
    const twoDaysLater = new Date();
    twoDaysLater.setDate(today.getDate() + 2);

    const nearExpiryCount = await Batch.countDocuments({
      expiryAt: { $gte: today, $lte: twoDaysLater },
      availableStock: { $gt: 0 },
      status: "active"
    });

   res.render("home", {
  user: userData,
  categories,
  showExpiryBanner: nearExpiryCount > 0,
  cloudinaryVideo:"https://res.cloudinary.com/dtfzp8rwt/video/upload/v1775533742/5318759-uhd_4096_2160_30fps_itjqje.mp4"
});
  } catch (error) {
    console.error("Home page error:", error);
    res.status(500).send("Server Error");
  }
};

// ─────────────────────────────────────────
// SIGNUP
// ─────────────────────────────────────────
const signuppage = async (req, res) => {
  try {
    return res.render("signUp");
  } catch (error) {
    console.log("error in the signUp page", error);
    res.status(500).send("server error");
  }
};

const verifyOtpPage = async (req, res) => {
  try {
    return res.render("verify-otp");
  } catch (error) {
    console.log("error in the verify otp page", error);
    res.status(500).send("server error");
  }
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const createUser = async (req, res) => {
  try {
    const { name, gender, phone, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match"
      });
    }

    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists"
      });
    }

    const otp = generateOtp();
    console.log("Generated OTP:", otp);

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Email sending failed"
      });
    }

    req.session.userOtp = otp;
    req.session.otpExpiry = Date.now() + 65 * 1000;
    req.session.userData = { name, phone, email, password, gender };

    return res.status(200).json({
      success: true,
      message: "User created"
    });

  } catch (error) {
    console.error("sign error", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// ─────────────────────────────────────────
// OTP
// ─────────────────────────────────────────
const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!req.session.userOtp || !req.session.userData) {
      return res.status(400).json({ message: "OTP expired" });
    }

    if (Date.now() > req.session.otpExpiry) {
      return res.status(400).json({ message: "OTP expired" });
    }

    if (otp !== req.session.userOtp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const { name, phone, email, password, gender } = req.session.userData;

    let user = await User.findOne({ $or: [{ email }, { phone }] });

    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user = new User({
        name,
        phone,
        email,
        gender,
        password: hashedPassword,
        isVerified: true
      });
      await user.save();
    } else {
      user.isVerified = true;
      await user.save();
    }

    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email
    };

    delete req.session.userOtp;
    delete req.session.userData;
    delete req.session.otpExpiry;

    return res.status(200).json({ message: "OTP verified successfully" });

  } catch (error) {
    console.log("OTP verify error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const resendOtp = async (req, res) => {
  try {
    if (!req.session.userData) {
      return res.status(400).json({ message: "Session expired. Signup again." });
    }

    const email = req.session.userData.email;
    const otp = generateOtp();
    req.session.userOtp = otp;
    req.session.otpExpiry = Date.now() + 65 * 1000;

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.status(500).json({ message: "Failed to resend OTP" });
    }

    res.status(200).json({ message: "OTP resent successfully" });

  } catch (error) {
    console.log("Resend OTP error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────
// LOGIN / LOGOUT
// ─────────────────────────────────────────
const loadlogin = async (req, res) => {
  try {
    return res.render("login");
  } catch (error) {
    console.log("error in the loginpage", error);
    res.status(500).send("server side error");
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ 1. EMPTY CHECK (ADD THIS)
    if (!email || !password) {
      return res.render("login", {
        error: "Please enter email and password"
      });
    }

    // ✅ 2. FIND USER
    const user = await User.findOne({ email });

    if (!user) {
      return res.render("login", { error: "User not found" });
    }

    // ✅ 3. BLOCK CHECK (MOVE THIS UP)
    if (user.isBlocked) {
      return res.render("login", { error: "Your account is blocked" });
    }

    // ✅ 4. GOOGLE LOGIN CHECK
    if (!user.password) {
      return res.render("login", {
        error: "Please login using Google"
      });
    }

    // ✅ 5. PASSWORD CHECK
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.render("login", { error: "Wrong password" });
    }

    // ✅ 6. SESSION (KEEP CONSISTENT)
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email
    };

    return res.redirect(303, "/");

  } catch (error) {
    console.log("login error:", error);
    res.status(500).send("Server error");
  }
};
const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Session destruction error", err.message);
        return res.redirect("/pageNotFound");
      }
      return res.redirect("/login");
    });
  } catch (error) {
    console.log("Logout error", error);
    res.redirect("/pageNotFound");
  }
};

// ─────────────────────────────────────────
// FORGOT PASSWORD
// ─────────────────────────────────────────
const forgotPasswordPage = async (req, res) => {
  res.render("forgotPassword");
};

const sendForgotOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const otp = generateOtp();
    req.session.forgotOtp = otp;
    req.session.forgotOtpExpiry = Date.now() + 5 * 60 * 1000;
    req.session.forgotEmail = email;

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.status(500).json({ message: "Failed to send OTP" });
    }

    res.redirect("/verifyOTP");

  } catch (error) {
    console.log("Forgot OTP error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const verifyForgotOtpPage = async (req, res) => {
  res.render("verifyOTP");
};

const verifyForgotOtp = async (req, res) => {
  try {
    const { otp1, otp2, otp3, otp4, otp5, otp6 } = req.body;
    const otp = otp1 + otp2 + otp3 + otp4 + otp5 + otp6;

    if (!req.session.forgotOtp) {
      return res.status(400).json({ message: "OTP expired" });
    }

    if (Date.now() > req.session.forgotOtpExpiry) {
      return res.status(400).json({ message: "OTP expired" });
    }

    if (otp !== req.session.forgotOtp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    req.session.isOtpVerified = true;
    res.redirect("/resetPassword");

  } catch (error) {
    console.log("Verify forgot OTP error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const resetPasswordPage = async (req, res) => {
  if (!req.session.isOtpVerified) {
    return res.redirect("/login");
  }
  res.render("resetPassword");
};

const updatePassword = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    if (!req.session.forgotEmail) {
      return res.redirect("/login");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await User.updateOne(
      { email: req.session.forgotEmail },
      { $set: { password: hashedPassword } }
    );

    req.session.forgotOtp = null;
    req.session.forgotEmail = null;
    req.session.isOtpVerified = null;

    res.redirect("/login");

  } catch (error) {
    console.log("Update password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────
module.exports = {
  loadHomePage,
  signuppage,
  verifyOtpPage,
  createUser,
  verifyOtp,
  resendOtp,
  loadlogin,
  loginUser,
  logout,
  forgotPasswordPage,
  sendForgotOtp,
  verifyForgotOtpPage,
  verifyForgotOtp,
  resetPasswordPage,
  updatePassword
};
