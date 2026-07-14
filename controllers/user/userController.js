import User from "../../models/userModel.js";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { sendVerificationEmail } from "../../utils/email.js";
import Batch from "../../models/batchModel.js";
import Category from "../../models/categoryModel.js";
import Coupon from "../../models/couponModel.js";
import WalletTransaction from "../../models/walletModel.js";
dotenv.config();

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
const referral = req.query.ref || "";

return res.render("signUp", {
  referral
});
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

function generateReferralCode(name) {

  return (
    name.substring(0, 4).toUpperCase() +
    Math.floor(1000 + Math.random() * 9000)
  );

}
const createUser = async (req, res) => {
  try {
const {
  name,
  gender,
  phone,
  email,
  password,
  confirmPassword,
  referral
} = req.body;
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match"
      });
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 10-digit phone number"
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

    const emailSent = await sendVerificationEmail(email, otp,65 / 60);
    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Email sending failed"
      });
    }
let referredUser = null;

if (referral) {

  referredUser = await User.findOne({
    referralCode: referral
  });

}
    req.session.userOtp = otp;
    req.session.otpExpiry = Date.now() + 65 * 1000;
req.session.userData = {
  name,
  phone,
  email,
  password,
  gender,

  referralCode:
    generateReferralCode(name),

  referredBy:
    referredUser?._id || null
};
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

const {
  name,
  phone,
  email,
  password,
  gender,
  referralCode,
  referredBy
} = req.session.userData;

    let user = await User.findOne({ $or: [{ email }, { phone }] });

    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user = new User({
        name,
        phone,
        email,
        gender,
        password: hashedPassword,
        referralCode,
        referredBy,
        isVerified: true,
      });
      await user.save();

   if (referredBy) {
        const referrer = await User.findById(referredBy);

   // FIXED ✅
if (referrer) {
  // ── reward referrer with ₹100 wallet credit ──
  const newReferrerBalance = (referrer.walletBalance || 0) + 100;

  // ✅ THIS WAS MISSING — update walletBalance on the User document
  await User.findByIdAndUpdate(
    referrer._id,
    { $set: { walletBalance: newReferrerBalance } },
    { new: true }
  );

  await WalletTransaction.create({
    userId:       referrer._id,
    type:         "credit",
    amount:       100,
    description:  "Referral bonus — friend signed up",
    balanceAfter: newReferrerBalance
  });

          // ── give new user a personal 10% off coupon ──
          await Coupon.create({
            code:          "REF-" + user._id.toString().slice(-6).toUpperCase(),
            discountType:  "percentage",
            discountValue: 10,
            maxDiscount:   100,
            minPurchase:   0,
            usageLimit:    1,
            usedBy:        [],
            expiryDate:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            isActive:      true,
            isDeleted:     false,
            assignedTo:    user._id
          });
        }
      }
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

// FIXED ✅
const resendOtp = async (req, res) => {
  try {
    if (!req.session.userData) {
      return res.status(400).json({ message: "Session expired. Signup again." });
    }

    // ✅ Block if resend was clicked within last 30 seconds
    if (req.session.resendCooldown && Date.now() < req.session.resendCooldown) {
      const secondsLeft = Math.ceil((req.session.resendCooldown - Date.now()) / 1000);
      return res.status(429).json({ 
        message: `Please wait ${secondsLeft} seconds before resending.` 
      });
    }

    // ✅ Set 30-second cooldown
    req.session.resendCooldown = Date.now() + 30 * 1000;

    const email = req.session.userData.email;
    const otp = generateOtp();
    req.session.userOtp = otp;
    req.session.otpExpiry = Date.now() + 65 * 1000;
    console.log(otp);
    const emailSent = await sendVerificationEmail(email, otp,65 / 60);
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
    const error = req.query.blocked === "true"
      ? "Your account has been blocked. Please contact support."
      : undefined;
    return res.render("login", { error });
  } catch (error) {
    console.log("error in the loginpage", error);
    res.status(500).send("server side error");
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    

    if (!email || !password) {
      return res.render("login", { error: "Please enter email and password" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.render("login", { error: "User not found" });
    }

    
    if (user.isAdmin) {
      return res.render("login", { error: "Access denied" });
    }

    if (user.isBlocked) {
      return res.render("login", { error: "Your account is blocked" });
    }

    if (!user.password) {
      return res.render("login", { error: "Please login using Google" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render("login", { error: "Wrong password" });
    }

    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email
    };

    return res.redirect(303, "/");

  } catch (error) {
    console.log("login error:", error);
    return res.status(500).send("Server error");
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {        
      if (err) console.log("Session destruction error", err.message);
      res.clearCookie("user_sid");        
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

    const emailSent = await sendVerificationEmail(email, otp,1);
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
// STATIC PAGES
// ─────────────────────────────────────────
const getAbout = async (req, res) => {
  try {
    let userData = null;
    if (req.session.user) {
      userData = await User.findById(req.session.user.id).lean();
    }
res.render("about", { user: userData, title: "About Us" });
  } catch (error) {
    console.error("About page error:", error);
    res.redirect("/pageNotFound");
  }
};

const getContactUs = async (req, res) => {
  try {
    let userData = null;
    if (req.session.user) {
      userData = await User.findById(req.session.user.id).lean();
    }
  res.render("contactUs", {
      user: userData,
      title: "Contact Us",
      success: req.query.success || null,
      error:   req.query.error   || null
    });
  } catch (error) {
    console.error("Contact page error:", error);
    res.redirect("/pageNotFound");
  }
};

const postContactUs = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.redirect("/contact-us?error=Please fill in all fields");
    }

    const ContactMessage = (await import("../../models/Contactmessagemodel.js")).default;
    const newMsg = new ContactMessage({
      name,
      email,
      subject,
      messages: [{ sender: 'user', text: message.trim() }],
      status: 'open',
      lastActivityAt: new Date()
    });
    await newMsg.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      }
    });

    await transporter.sendMail({
      from: `"Cake O'Clock" <${process.env.NODEMAILER_EMAIL}>`,
      to:   process.env.NODEMAILER_EMAIL,
      subject: `📩 New Ticket #${newMsg.ticketNumber}: ${subject}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:10px;overflow:hidden;">
          <div style="background:#3d1a24;padding:20px 24px;">
            <h2 style="color:#e8a0b0;margin:0;font-size:1.1rem;">New Ticket — Cake O'Clock</h2>
            <p style="color:#e8a0b0cc;margin:4px 0 0;font-size:.75rem;">#${newMsg.ticketNumber}</p>
          </div>
          <div style="padding:24px;">
            <p><strong>From:</strong> ${name} (${email})</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
            <p style="color:#444;line-height:1.7;">${message.replace(/\n/g, '<br>')}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
            <a href="${process.env.BASE_URL}/admin/contact-messages/${newMsg._id}"
               style="display:inline-block;background:#3d1a24;color:#fff;padding:10px 20px;
                      border-radius:8px;text-decoration:none;font-size:.85rem;">
              View in Admin Panel →
            </a>
          </div>
        </div>
      `
    });

    res.redirect("/contact-us?success=true");
  } catch (error) {
    console.error("Contact form error:", error);
    res.redirect("/contact-us");
  }
};


const getCustomerSupport = async (req, res) => {
  try {
    let userData = null;
    if (req.session.user) {
      userData = await User.findById(req.session.user.id).lean();
    }
    res.render("customerSupport", { user: userData, title: "Customer Support" });
  } catch (error) {
    console.error("Support page error:", error);
    res.redirect("/pageNotFound");
  }
};

// ─────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────
export {
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
  updatePassword,
  getAbout,          
  getContactUs,      
  postContactUs,     
  getCustomerSupport 
};
