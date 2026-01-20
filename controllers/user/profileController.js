const User = require("../../models/userModel");
const cloudinary = require("../../config/cloudinary");
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
    res.redirect("/profile");
  } catch (error) {
    console.error("Edit profile error:", error);
    res.redirect("/pageNotFound");
  }
};

module.exports = {
  userProfile,
  editProfileLoad,
  editProfilePost,
};
