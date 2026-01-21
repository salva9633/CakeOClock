const User = require("../../models/userModel");
const cloudinary = require("../../config/cloudinary");
const bcrypt = require("bcrypt");

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

    user.name = name;
    user.phone = phone;
    user.gender = gender;

    if (user.authType === "local") {
      user.email = email;
    }

    // ✅ UPLOAD IMAGE TO CLOUDINARY
    if (req.file) {
      const result = await cloudinary.uploader.upload(
        `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
        { folder: "user_profiles" }
      );

      // ✅ SAVE CLOUDINARY URL
      user.profileImage = result.secure_url;
    }

    await user.save();
res.redirect("/address");
  } catch (error) {
    console.error("Edit profile error:", error);
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
  changePassword

};