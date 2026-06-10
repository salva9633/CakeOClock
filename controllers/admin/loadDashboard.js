import Order from "../../models/orderModel.js";

export const loadDashboard = async (req, res) => {

  try {

    const filter = req.query.filter || "monthly";

    let startDate = new Date();

 switch (filter) {
  case "daily":
    startDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0);
    break;
  case "weekly": {
    const day = startDate.getDay();
    const diff = day === 0 ? 6 : day - 1;
    startDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() - diff, 0, 0, 0);
    break;
  }
  case "yearly":
    startDate = new Date(startDate.getFullYear() - 4, 0, 1);
    break;
  default: // monthly
    startDate = new Date(startDate.getFullYear(), 0, 1);
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

const cancelledOrders = await Order.countDocuments({
  createdAt: { $gte: startDate },
  status: "Cancelled"
});
   // =========================
// CHART DATA (grouped by period)
// =========================

// =========================
// CHART DATA (grouped by period)
// =========================

let chartLabels = [];
let chartData = [];

if (filter === "daily") {

  const hourMap = {};

  for (let h = 0; h < 24; h++) {
    hourMap[`${String(h).padStart(2, "0")}:00`] = 0;
  }

  orders.forEach(order => {
    const hour = `${String(new Date(order.createdAt).getHours()).padStart(2, "0")}:00`;
    hourMap[hour] += order.finalTotal;
  });

  chartLabels = Object.keys(hourMap);
  chartData = Object.values(hourMap);

} else if (filter === "weekly") {

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayMap = {};

  days.forEach(day => {
    dayMap[day] = 0;
  });

  orders.forEach(order => {
    const jsDay = new Date(order.createdAt).getDay();
    const dayName = days[jsDay === 0 ? 6 : jsDay - 1];
    dayMap[dayName] += order.finalTotal;
  });

  chartLabels = Object.keys(dayMap);
  chartData = Object.values(dayMap);

} else if (filter === "yearly") {

  const currentYear = new Date().getFullYear();
  const yearMap = {};

  for (let year = currentYear - 4; year <= currentYear; year++) {
    yearMap[year] = 0;
  }

  orders.forEach(order => {
    const year = new Date(order.createdAt).getFullYear();

    if (yearMap[year] !== undefined) {
      yearMap[year] += order.finalTotal;
    }
  });

  chartLabels = Object.keys(yearMap);
  chartData = Object.values(yearMap);

} else {

  // Monthly chart (Jan-Dec)

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const monthMap = {};

  months.forEach(month => {
    monthMap[month] = 0;
  });

  orders.forEach(order => {
    const month = months[new Date(order.createdAt).getMonth()];
    monthMap[month] += order.finalTotal;
  });

  chartLabels = Object.keys(monthMap);
  chartData = Object.values(monthMap);
}
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