const User = require("../../models/userModel");

const customerInfo = async (req, res) => {
  try {
    let search = req.query.search || "";
    let page = parseInt(req.query.page) || 1;
    const limit = 5;

    const query = {
      isAdmin: false,
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ]
    };

    const users = await User.find(query)
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);

    res.render("customers", {
      users,
      totalUsers,
      totalPages,
      currentPage: page,
      search
    });

  } catch (error) {
    console.log(error);
    res.redirect("/admin/pagenotfound");
  }
};
const blockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isBlocked: true });
    res.redirect("/admin/users");
  } catch (err) {
    console.log(err);
    res.redirect("/admin/pagenotfound");
  }
};

// GET /admin/unblock-user/:id → unblock a user
const unblockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isBlocked: false });
    res.redirect("/admin/users");
  } catch (err) {
    console.log(err);
    res.redirect("/admin/pagenotfound");
  }
};

module.exports = { customerInfo, blockUser, unblockUser };
