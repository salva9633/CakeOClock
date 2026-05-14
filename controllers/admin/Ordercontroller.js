import Order from "../../models/orderModel.js";
 
// ─────────────────────────────────────────
// GET /admin/orders
// ─────────────────────────────────────────
export const loadOrders = async (req, res) => {
  try {
    const { search = "", status = "", sort = "date-desc", page = 1 } = req.query;
    const LIMIT = 10;
    const skip  = (Number(page) - 1) * LIMIT;
 
    const filter = {};
    if (status) filter.status = status;
    if (search.trim()) {
      filter.$or = [
        { orderId:             { $regex: search, $options: "i" } },
        { "address.name":      { $regex: search, $options: "i" } },
        { "address.phone":     { $regex: search, $options: "i" } },
        { "items.productName": { $regex: search, $options: "i" } },
      ];
    }
 
    const sortMap = {
      "date-desc":  { createdAt: -1 },
      "date-asc":   { createdAt:  1 },
      "total-desc": { finalTotal: -1 },
      "total-asc":  { finalTotal:  1 },
    };
    const sortQuery = sortMap[sort] || { createdAt: -1 };
 
    const [orders, total, statusCounts] = await Promise.all([
      Order.find(filter)
        .populate("userId", "name email")
        .sort(sortQuery)
        .skip(skip)
        .limit(LIMIT)
        .lean(),
      Order.countDocuments(filter),
      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);
 
    const counts = {
      All: 0, Pending: 0, Processing: 0,
      Shipped: 0, Delivered: 0, Cancelled: 0, Returned: 0,
    };
    let grandTotal = 0;
    statusCounts.forEach(({ _id, count }) => {
      if (_id in counts) counts[_id] = count;
      grandTotal += count;
    });
    counts.All = grandTotal;
 
    return res.render("orders", {
      orders,
      counts,
      total,
      totalPages: Math.ceil(total / LIMIT),
      currentPage: Number(page),
      search,
      status,
      sort,
      title: "Order Management",
    });
  } catch (error) {
    console.error("loadOrders error:", error);
    return res.redirect("/admin/pagenotfound");
  }
};
 
// ─────────────────────────────────────────
// GET /admin/orders/:id
// ─────────────────────────────────────────
export const loadOrderDetail = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("items.productId");
    if (!order) return res.redirect("/admin/orders");
    return res.render("orderDetail", { order, title: "Order Detail" });
  } catch (error) {
    console.error("loadOrderDetail error:", error);
    return res.redirect("/admin/pagenotfound");
  }
};
 
// ─────────────────────────────────────────
// PATCH /admin/orders/:id/status
// Update overall order status + sync all item statuses
// ─────────────────────────────────────────
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const STATUS_ORDER = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
 
    if (!STATUS_ORDER.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
 
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
 
    // ✅ Prevent changing locked statuses
    const LOCKED = ['Delivered', 'Cancelled', 'Returned'];
    if (LOCKED.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from "${order.status}"`,
      });
    }
 
    // ✅ Prevent backward movement
    const currentIdx = STATUS_ORDER.indexOf(order.status);
    const newIdx     = STATUS_ORDER.indexOf(status);
    if (newIdx < currentIdx) {
      return res.status(400).json({
        success: false,
        message: `Cannot move status backward from "${order.status}" to "${status}"`,
      });
    }
 
    // ✅ Update order-level status
    order.status = status;
 
    // ✅ Sync every active item to the new status
    order.items.forEach(item => {
      if (!['Cancelled', 'Returned'].includes(item.status)) {
        item.status = status;
      }
    });
 
    await order.save();
 
    return res.json({ success: true, message: 'Status updated', status: order.status });
 
  } catch (error) {
    console.error('updateOrderStatus error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
 
// ─────────────────────────────────────────
// PATCH /admin/orders/:id/items/:itemId/status
// Update a single item's status
// ─────────────────────────────────────────
export const updateItemStatus = async (req, res) => {
  try {
    const { status, reason } = req.body;
    const VALID = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
 
    if (!VALID.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
 
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
 
    const item = order.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
 
    item.status = status;
    if (status === 'Cancelled') item.cancelReason = reason || null;
    if (status === 'Returned')  item.returnReason  = reason || null;
 
    // ✅ Reflect on order-level if all items match
    const allCancelled = order.items.every(i => i.status === 'Cancelled');
    const allReturned  = order.items.every(i => i.status === 'Returned');
    if (allCancelled) order.status = 'Cancelled';
    if (allReturned)  order.status = 'Returned';
 
    await order.save();
 
    return res.json({ success: true, message: 'Item status updated' });
 
  } catch (error) {
    console.error('updateItemStatus error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────
// GET /admin/orders/:id/poll-status
// Lightweight polling endpoint
// ─────────────────────────────────────────
export const pollOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .select('status updatedAt')
      .lean();
    if (!order) return res.status(404).json({ success: false });
    return res.json({ success: true, status: order.status, updatedAt: order.updatedAt });
  } catch (error) {
    console.error('pollOrderStatus error:', error);
    return res.status(500).json({ success: false });
  }
};