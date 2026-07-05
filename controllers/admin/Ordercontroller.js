import Order from "../../models/orderModel.js";
import WalletTransaction from "../../models/walletModel.js";
import User from "../../models/userModel.js";
import Coupon from "../../models/couponModel.js"; 
import { renderAdmin } from "../../utils/renderAdmin.js";

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
      Shipped: 0, Delivered: 0, Cancelled: 0, Returned: 0, "Return Requested": 0,
    };
    let grandTotal = 0;
    statusCounts.forEach(({ _id, count }) => {
      if (_id in counts) counts[_id] = count;
      grandTotal += count;
    });
    counts.All = grandTotal;
 
    return renderAdmin(req, res, "orders", {
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
return renderAdmin(req, res, "orderDetail", { order, title: "Order Detail" });  } catch (error) {
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
 
    
const LOCKED = ['Cancelled', 'Returned'];
if (LOCKED.includes(order.status)) {
  return res.status(400).json({
    success: false,
    message: `Cannot change status from "${order.status}"`,
  });
}

// Cannot cancel after delivery
if (status === 'Cancelled' && order.status === 'Delivered') {
  return res.status(400).json({
    success: false,
    message: `Cannot cancel a delivered order`,
  });
}
 
const currentIdx = STATUS_ORDER.indexOf(order.status);
const newIdx = STATUS_ORDER.indexOf(status);

// only next step allowed
if (newIdx !== currentIdx + 1) {
  return res.status(400).json({
    success: false,
    message: `Order status must follow step-by-step flow`,
  });
}
    
    order.status = status;
 
  
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

// LOAD RETURN REQUESTS
export const loadReturnRequests = async (req, res) => {

  try {

    const orders = await Order.find({
      "items.status": "Return Requested"
    }).populate("userId");

   renderAdmin(req, res, "returnRequests", {
      orders,
      title: "Return Requests",
    });

  } catch (error) {

    console.log(error);
    res.redirect("/admin/pageerror");
  }
};


// APPROVE RETURN
export const approveReturnRequest = async (req, res) => {
  try {
    const { orderId, itemId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res.json({ success: false, message: "Item not found" });
    }

    // already refunded
    if (item.status === "Returned") {
      return res.json({ success: false, message: "Already refunded" });
    }

    // must be Return Requested to approve
    if (item.status !== "Return Requested") {
      return res.json({ success: false, message: "Item is not in Return Requested state" });
    }

    // ✅ update item status to Returned
    item.status = "Returned";

    // Calculate this item's share of the order discount
    const orderItemTotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const itemSubtotal   = item.price * item.quantity;
    const discountShare  = orderItemTotal > 0
      ? Math.round((itemSubtotal / orderItemTotal) * (order.discount || 0))
      : 0;
    const refundAmount   = itemSubtotal - discountShare;

    // ── Recalculate order totals after return ──
    const activeItems = order.items.filter(
      i => i.status !== 'Cancelled' && i.status !== 'Returned'
    );
    const newItemTotal = activeItems.reduce(
      (sum, i) => sum + i.price * i.quantity, 0
    );
let newDiscount = 0;
    if (order.couponCode) {
      const couponDoc = await Coupon.findOne({ code: order.couponCode });
      if (couponDoc && newItemTotal >= couponDoc.minPurchase) {
        newDiscount = couponDoc.discountType === "percentage"
          ? Math.min((newItemTotal * couponDoc.discountValue) / 100, couponDoc.maxDiscount || Infinity)
          : couponDoc.discountValue;
        newDiscount = Math.round(Math.min(newDiscount, newItemTotal));
      } else {
        order.couponCode = null;
      }
    }
    order.itemTotal  = newItemTotal;
    order.discount   = newDiscount;
    order.finalTotal = newItemTotal - newDiscount + (order.tax || 0) + (order.shippingCharge || 0);    // ──────────────────────────────────────────

    // credit wallet
    const user = await User.findById(order.userId);
    const newBalance = (user.walletBalance || 0) + refundAmount;
    await User.findByIdAndUpdate(order.userId, { walletBalance: newBalance });
    await WalletTransaction.create({
      userId:       order.userId,
      type:         "credit",
      amount:       refundAmount,
      description:  `Refund for ${item.productName} (Order: ${order.orderId})`,
      orderId:      order._id,
      balanceAfter: newBalance
    });

    // ✅ update order-level status
    const allDone = order.items.every(
      i => i.status === "Returned" || i.status === "Cancelled"
    );
    const anyStillRequested = order.items.some(
      i => i.status === "Return Requested"
    );

    if (allDone) {
      order.status = "Returned";
    } else if (!anyStillRequested) {
      order.status = "Delivered";
    }

    await order.save();

    return res.json({
      success: true,
      message: "Return approved and refunded to wallet",
    });

  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: "Server error" });
  }
};// REJECT RETURN
export const rejectReturnRequest = async (req, res) => {
  try {
    const { orderId, itemId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res.json({ success: false, message: "Item not found" });
    }

    // ✅ set item back to Delivered
    item.status = "Return Rejected";   // user sees "Return Rejected"
    item.returnReason = null;

    // ✅ fix order-level status
    const anyStillRequested = order.items.some(
      i => i.status === "Return Requested"
    );
    if (!anyStillRequested) {
      order.status = "Delivered";
    }

    await order.save();

    return res.json({ success: true, message: "Return request rejected" });

  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: "Server error" });
  }
};