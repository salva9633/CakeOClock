import User     from "../../models/userModel.js";
import Order    from "../../models/orderModel.js";
import Wishlist from "../../models/wishlistModel.js";
import cloudinary from "../../config/cloudinary.js";
import bcrypt from "bcrypt";
import { sendVerificationEmail } from "../../utils/email.js";

/* ================= PROFILE PAGE ================= */
const userProfile = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect("/login");

    const userId = req.session.user.id;
    const user   = await User.findById(userId);
    if (!user) return res.redirect("/login");

    const [totalOrders, wishlistDoc] = await Promise.all([
      Order.countDocuments({ userId }),
      Wishlist.findOne({ userId }).lean()
    ]);

    user.totalOrders   = totalOrders;
    user.wishlistCount = wishlistDoc?.products?.length || 0;

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

  
    user.name = name;
    user.phone = phone;
    user.gender = gender;

    
    if (user.authType === "google") {
      await user.save();
      return res.redirect("/profile");
    }

 // FIXED ✅ — save new email in session, redirect to OLD email OTP first
if (email && email !== user.email) {
  const existing = await User.findOne({ email, _id: { $ne: user._id } });
  if (existing) {
    return res.render("editProfile", { user, emailError: "Email already in use" });
  }

  // Step 1: Send OTP to OLD email
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log("Old email OTP:", otp);

  req.session.emailChangeOtp    = otp;
  req.session.emailChangeExpiry = Date.now() + 5 * 60 * 1000;
  req.session.newEmail          = email;          // store new email for later
  req.session.oldEmailVerified  = false;          // not yet verified

  await sendVerificationEmail(user.email, otp);   // ← send to OLD email

  return res.redirect("/verifyEmailOtp?step=old");
}

    
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
  const step = req.query.step || "old";

  // ✅ Allow step=new through even if newEmail is in session being processed
  if (!req.session.newEmail && !req.session.emailChangeOtp) {
    return res.redirect("/editProfile");
  }

  res.render("verifyEmailOtp", { step, error: undefined });
};

// FIXED ✅ — two-step: verify old email OTP, then send & verify new email OTP
const verifyEmailOtp = async (req, res) => {
  try {
    const { otp1, otp2, otp3, otp4, otp5, otp6 } = req.body;
    const otp  = otp1 + otp2 + otp3 + otp4 + otp5 + otp6;
    const step = req.query.step || "old";

    if (!req.session.emailChangeOtp || Date.now() > req.session.emailChangeExpiry) {
      return res.redirect("/editProfile");
    }

    if (otp !== req.session.emailChangeOtp) {
      return res.render("verifyEmailOtp", {
        error: "Invalid OTP. Please try again.",
        step
      });
    }

    if (step === "old") {
      // ✅ Old email verified — now send OTP to NEW email
      req.session.oldEmailVerified = true;
      delete req.session.emailChangeOtp;
      delete req.session.emailChangeExpiry;

      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      console.log("New email OTP:", newOtp);

      req.session.emailChangeOtp    = newOtp;
      req.session.emailChangeExpiry = Date.now() + 5 * 60 * 1000;

      await sendVerificationEmail(req.session.newEmail, newOtp); // ← send to NEW email

return res.redirect(303, "/verifyEmailOtp?step=new");
} else {
  // ✅ New email verified — update DB
  if (!req.session.oldEmailVerified) return res.redirect("/editProfile");

  await User.findByIdAndUpdate(req.session.user.id, {
    $set: { email: req.session.newEmail }
  });

  req.session.user.email = req.session.newEmail;

  // Cleanup
  delete req.session.emailChangeOtp;
  delete req.session.emailChangeExpiry;
  delete req.session.newEmail;
  delete req.session.oldEmailVerified;

return res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
  </head>
  <body>
    <script>
      window.onload = function () {
        Swal.fire({
          icon: 'success',
          title: 'Email Updated!',
          text: 'Your email has been changed successfully.',
          confirmButtonColor: '#8B4A5A',
          confirmButtonText: 'Go to Profile'
        }).then(() => {
          window.location.href = '/profile';
        });
      };
    </script>
  </body>
  </html>
`);
}
  } catch (error) {
    console.error("verifyEmailOtp error:", error);
    res.redirect("/pageNotFound");
  }
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
    const {
      name, phone, altPhone, street,
      address, landmark, city, state, pincode, type
    } = req.body;

    const from = req.query.from; 

    await User.findByIdAndUpdate(req.session.user.id, {
      $push: {
        addresses: {
          name, phone, street, city, state, pincode, type,
          address: address || null,
          landmark: landmark || null,
          altPhone: altPhone || null
        }
      }
    });

    res.redirect(from === "checkout" ? "/checkout" : "/address"); 

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

    const redirect = req.query.redirect || "/address"; 

    res.render("editAddress", { address, redirect }); 
  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};
const updateAddress = async (req, res) => {
  try {
    const {    name,
      phone,
      altPhone,
      street,
      address,
      landmark,
      city,
      state,
      pincode,
      type } = req.body;

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
          "addresses.$.type": type,
          "addresses.$.address": address || null,
          "addresses.$.landmark": landmark || null,
          "addresses.$.altPhone": altPhone || null

        }
      }
    );

const redirect = req.query.redirect || "/address";
    res.redirect(redirect);
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

    
    if (user.authType === "google") {
      return res.render("user/changePassword", {
        user,
        error: "Password change is not available for Google login accounts",
        success: null
      });
    }

    
    if (!user.password) {
      return res.render("user/changePassword", {
        user,
        error: null,
        success: null,
        noPassword: true  
      });
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.render("user/changePassword", {
        user,
        error: "All fields are required",
        success: null
      });
    }

    
    if (newPassword.length < 8) {
      return res.render("user/changePassword", {
        user,
        error: "Password must be at least 8 characters",
        success: null
      });
    }


    if (newPassword !== confirmPassword) {
      return res.render("user/changePassword", {
        user,
        error: "Passwords do not match",
        success: null
      });
    }

    
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.render("user/changePassword", {
        user,
        error: "Current password is incorrect",
        success: null
      });
    }

  
    const samePassword = await bcrypt.compare(newPassword, user.password);
    if (samePassword) {
      return res.render("user/changePassword", {
        user,
        error: "New password must be different from old password",
        success: null
      });
    }

    
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    
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

export {
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
