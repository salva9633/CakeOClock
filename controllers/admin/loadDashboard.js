import Order from "../../models/orderModel.js";

export const loadDashboard = async (req, res) => {

  try {

    const filter = req.query.filter || "monthly";

    let startDate = new Date();

    switch (filter) {
      case "daily":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "weekly":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "yearly":
        startDate = new Date(startDate.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    }

    // =========================
    // ORDERS
    // =========================

    const orders = await Order.find({
      createdAt: { $gte: startDate },
      status: { $nin: ["Cancelled"] }
    }).populate("items.productId");

    // =========================
    // SUMMARY
    // =========================

    const totalOrders = orders.length;

    const totalRevenue = orders.reduce((sum, order) => sum + order.finalTotal, 0);

    const deliveredOrders = orders.filter(order => order.status === "Delivered").length;

    const cancelledOrders = orders.filter(order => order.status === "Cancelled").length;

    // =========================
    // CHART DATA
    // =========================

    const chartLabels = orders.map(order =>
      new Date(order.createdAt).toLocaleDateString("en-IN")
    );

    const chartData = orders.map(order => order.finalTotal);

    // =========================
    // TOP PRODUCTS
    // =========================

    const topProducts = await Order.aggregate([
      { $match: { status: { $ne: "Cancelled" } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          totalSold: { $sum: "$items.quantity" }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" }
    ]);

    // =========================
    // TOP CATEGORIES
    // =========================

    const topCategories = await Order.aggregate([
      { $match: { status: { $ne: "Cancelled" } } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$product.categoryId",
          totalSold: { $sum: "$items.quantity" }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: "$category" }
    ]);

    // =========================
    // TOP BRANDS
    // =========================

    const topBrands = await Order.aggregate([
      { $match: { status: { $ne: "Cancelled" } } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$product.brand",
          totalSold: { $sum: "$items.quantity" }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);

    // =========================
    // DEBUG - remove after confirmed working
    // =========================

    const sampleOrder = await Order.findOne({}).lean();
    console.log("SAMPLE ITEM:", JSON.stringify(sampleOrder?.items?.[0], null, 2));
    console.log("topCategories count:", topCategories.length);
    console.log("topBrands count:", topBrands.length);

    // =========================
    // RENDER
    // =========================

    res.render("dashboard", {
      totalOrders,
      totalRevenue,
      deliveredOrders,
      cancelledOrders,
      chartLabels,
      chartData,
      topProducts,
      topCategories,
      topBrands,
      filter
    });

  } catch (error) {
    console.log(error);
    res.redirect("/admin/pageerror");
  }
};