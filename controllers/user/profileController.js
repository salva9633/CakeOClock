const User = require("../../models/userModel");
const cloudinary = require("../../config/cloudinary");
const bcrypt = require("bcrypt");
const { sendVerificationEmail } = require("../../utils/email");


/* ================= PROFILE PAGE ================= */
const userProfile = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect("/login");

    res.render("profile", { user });
  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};

/* ================= EDIT PROFILE PAGE ================= */
const editProfileLoad = async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect("/login");

    res.render("editProfile", { user });
  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};

/* ================= EDIT PROFILE POST ================= */
const editProfilePost = async (req, res) => {
  try {
    const { name, email, phone, gender } = req.body;

    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect("/login");

    // update non-sensitive fields
    user.name = name;
    user.phone = phone;
    user.gender = gender;

    // 🚫 GOOGLE USERS: EMAIL CHANGE BLOCKED
    if (user.authType === "google") {
      await user.save();
      return res.redirect("/profile");
    }

    // 🔐 LOCAL USERS: EMAIL CHANGE WITH OTP
    if (email && email !== user.email) {

      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      req.session.emailChangeOtp = otp;
      req.session.emailChangeExpiry = Date.now() + 5 * 60 * 1000;
      req.session.newEmail = email;

      await sendVerificationEmail(email, otp);

      // ⛔ stop execution until OTP verified
      return res.redirect("/verifyEmailOtp");
    }

    // profile image upload
    if (req.file) {
      const result = await cloudinary.uploader.upload(
        `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
        { folder: "user_profiles" }
      );
      user.profileImage = result.secure_url;
    }

    await user.save();
    res.redirect("/profile");

  } catch (error) {
    console.error("Edit profile error:", error);
    res.redirect("/pageNotFound");
  }
};

const verifyEmailOtpPage = (req, res) => {
  if (!req.session.newEmail) return res.redirect("/editProfile");
  res.render("verifyEmailOtp");
};

const verifyEmailOtp = async (req, res) => {
  const { otp1, otp2, otp3, otp4, otp5, otp6 } = req.body;
  const otp = otp1 + otp2 + otp3 + otp4 + otp5 + otp6;

  if (
    !req.session.emailChangeOtp ||
    Date.now() > req.session.emailChangeExpiry
  ) {
    return res.redirect("/editProfile");
  }

  if (otp !== req.session.emailChangeOtp) {
    return res.render("verifyEmailOtp", { error: "Invalid OTP" });
  }

  // ✅ update email only now
  await User.findByIdAndUpdate(req.session.user.id, {
    email: req.session.newEmail
  });

  // cleanup
  delete req.session.emailChangeOtp;
  delete req.session.emailChangeExpiry;
  delete req.session.newEmail;

  res.redirect("/profile");
};


/* ================= ADDRESS PAGE ================= */
const addressPage = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect("/login");
    }

    const user = await User.findById(req.session.user.id);

    res.render("address", {
      addresses: user.addresses
    });

  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};







/* ================= ADD ADDRESS ================= */
const addAddress = async (req, res) => {
  try {
    const { name, phone, street, city, state, pincode, type } = req.body;

    await User.findByIdAndUpdate(req.session.user.id, {
      $push: {
        addresses: { name, phone, street, city, state, pincode, type }
      }
    });

    res.redirect("/address");
  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};










/* ================= DELETE ADDRESS ================= */
const deleteAddress = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.session.user.id, {
      $pull: { addresses: { _id: req.params.id } }
    });

    res.redirect("/address");
  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};

const editAddressPage = async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    const address = user.addresses.id(req.params.id);

    if (!address) return res.redirect("/address");

    res.render("editAddress", { address });
  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};


const updateAddress = async (req, res) => {
  try {
    const { name, phone, street, city, state, pincode, type } = req.body;

    await User.updateOne(
      { 
        _id: req.session.user.id,
        "addresses._id": req.params.id
      },
      {
        $set: {
          "addresses.$.name": name,
          "addresses.$.phone": phone,
          "addresses.$.street": street,
          "addresses.$.city": city,
          "addresses.$.state": state,
          "addresses.$.pincode": pincode,
          "addresses.$.type": type
        }
      }
    );

    res.redirect("/address");
  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};


const loadChangePassword = async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);

    if (!user) return res.redirect("/login");

    res.render("changePassword", {
      user,
      error: null,
      success: null
    });

  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    const user = await User.findById(req.session.user.id);

    if (!user) return res.redirect("/login");

    // 🚫 Google users
    if (user.authType === "google") {
      return res.render("user/changePassword", {
        user,
        error: "Password change is not available for Google login accounts",
        success: null
      });
    }

    // 🚫 No password set
    if (!user.password) {
  return res.render("user/changePassword", {
    user,
    error: null,
    success: null,
    noPassword: true   // 👈 FLAG
  });
}


    // 🚫 Empty fields
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.render("user/changePassword", {
        user,
        error: "All fields are required",
        success: null
      });
    }

    // 🚫 Length check
    if (newPassword.length < 8) {
      return res.render("user/changePassword", {
        user,
        error: "Password must be at least 8 characters",
        success: null
      });
    }

    // 🚫 Confirm password
    if (newPassword !== confirmPassword) {
      return res.render("user/changePassword", {
        user,
        error: "Passwords do not match",
        success: null
      });
    }

    // 🚫 Wrong current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.render("user/changePassword", {
        user,
        error: "Current password is incorrect",
        success: null
      });
    }

    // 🚫 Same password
    const samePassword = await bcrypt.compare(newPassword, user.password);
    if (samePassword) {
      return res.render("user/changePassword", {
        user,
        error: "New password must be different from old password",
        success: null
      });
    }

    // ✅ Save new password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    // 🔐 Logout after password change
    req.session.destroy(() => {
      res.redirect("/login");
    });

  } catch (error) {
    console.error("Change password error:", error);
    res.redirect("/pageNotFound");
  }
};


/* ================= CHECK CURRENT PASSWORD (AJAX) ================= */
const checkCurrentPassword = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.json({ valid: false });
    }

    const { currentPassword } = req.body;
    const userId = req.session.user.id;

    const user = await User.findById(userId);

    if (!user || !user.password) {
      return res.json({ valid: false });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    return res.json({ valid: isMatch });

  } catch (error) {
    console.error("Password check error:", error);
    res.status(500).json({ valid: false });
  }
};






module.exports = {
  userProfile,
  editProfileLoad,
  editProfilePost,
  addressPage,
  addAddress,
  deleteAddress,
  editAddressPage,
  updateAddress,
  loadChangePassword,
  changePassword,
  verifyEmailOtpPage,
  verifyEmailOtp,
  checkCurrentPassword


};