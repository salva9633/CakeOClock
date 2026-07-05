import User from "../../models/userModel.js";

const customerInfo = async (req, res) => {
  try {
    let search = req.query.search ? req.query.search.trim() : "";
    let status = req.query.status ? req.query.status.trim() : "all"; // all | active | blocked
    let page = parseInt(req.query.page) || 1;
    const limit = 5;

    let query = { isAdmin: false };

    if (search !== "") {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    if (status === "active") {
      query.isBlocked = false;
    } else if (status === "blocked") {
      query.isBlocked = true;
    }
    // status === "all" (or anything else) -> no isBlocked filter

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(totalUsers / limit));

    res.render("customers", { users, totalUsers, totalPages, currentPage: page, search, status });
  } catch (error) {
    console.log("Customer fetch error:", error);
    res.redirect("/admin/pagenotfound");
  }
};

const blockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isBlocked: true });

    const { page = 1, search = "", status = "all" } = req.query;
    res.redirect(`/admin/users?page=${page}&search=${search}&status=${status}`);
  } catch (err) {
    console.log(err);
    res.redirect("/admin/pagenotfound");
  }
};

const unblockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isBlocked: false });

    const { page = 1, search = "", status = "all" } = req.query;
    res.redirect(`/admin/users?page=${page}&search=${search}&status=${status}`);
  } catch (err) {
    console.log(err);
    res.redirect("/admin/pagenotfound");
  }
};

export { customerInfo, blockUser, unblockUser };