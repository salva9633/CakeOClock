import User from "../../models/userModel.js";

const customerInfo = async (req, res) => {
  try {
    let search = req.query.search ? req.query.search.trim() : "";
    let page = parseInt(req.query.page) || 1;
    const limit = 5;

    let query = { isAdmin: false };

    if (search !== "") {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);

    res.render("customers", { users, totalUsers, totalPages, currentPage: page, search });
  } catch (error) {
    console.log("Customer fetch error:", error);
    res.redirect("/admin/pagenotfound");
  }
};

const blockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isBlocked: true });

    const { page = 1, search = "" } = req.query;
    res.redirect(`/admin/users?page=${page}&search=${search}`);
  } catch (err) {
    console.log(err);
    res.redirect("/admin/pagenotfound");
  }
};

const unblockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isBlocked: false });

    const { page = 1, search = "" } = req.query;
    res.redirect(`/admin/users?page=${page}&search=${search}`);
  } catch (err) {
    console.log(err);
    res.redirect("/admin/pagenotfound");
  }
};

export { customerInfo, blockUser, unblockUser };
