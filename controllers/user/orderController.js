import Order from "../../models/orderModel.js";
import Batch from "../../models/batchModel.js";
import PDFDocument from "pdfkit";
 
/* ── GET /orders ────────────────────────────────────────────────────── */
export const listOrders = async (req, res) => {
  try {
    const userId  = req.user._id;
    const page    = parseInt(req.query.page) || 1;
    const limit   = 8;
    const search  = req.query.search?.trim() || "";
 
    const query = { userId };
    if (search) query.orderId = { $regex: search, $options: "i" };

    
 
    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Order.countDocuments(query)
    ]);
 
    res.render("orderList", {
      orders,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      search
    });
  } catch (err) {
    console.error("listOrders error:", err);
    res.redirect("/");
  }
};
 
/* ── GET /orders/:id ────────────────────────────────────────────────── */
export const orderDetail = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || String(order.userId) !== String(req.user._id)) {
      return res.redirect("/orders");
    }
  res.render("userOrderDetail", { order });
  } catch (err) {
    console.error("orderDetail error:", err);
    res.redirect("/orders");
  }
};
 
/* ── POST /orders/:id/cancel ────────────────────────────────────────── */
export const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);
 
    if (!order || String(order.userId) !== String(req.user._id)) {
      return res.json({ success: false, message: "Order not found" });
    }
 
    if (!["Pending", "Processing"].includes(order.status)) {
      return res.json({ success: false, message: "Order cannot be cancelled at this stage" });
    }
 
    
    for (const item of order.items) {
      if (item.status === "Cancelled") continue;
      await restoreStock(item.variantId, item.quantity);
      item.status = "Cancelled";
    }
 
    order.status         = "Cancelled";
    order.cancelReason   = reason || null;
    order.finalTotal     = 0;
    order.itemTotal      = 0;
    order.shippingCharge = 0;
    order.tax            = 0;
    await order.save();

    res.json({ success: true, message: "Order cancelled successfully" });
  } catch (err) {
    console.error("cancelOrder error:", err);
    res.json({ success: false, message: "Something went wrong" });
  }
};
 

export const cancelOrderItem = async (req, res) => {
  try {
    const { orderId, itemId, reason } = req.body;
    const order = await Order.findById(orderId);
 
    if (!order || String(order.userId) !== String(req.user._id)) {
      return res.json({ success: false, message: "Order not found" });
    }
 
    const item = order.items.id(itemId);
    if (!item) return res.json({ success: false, message: "Item not found" });
 
    if (!["Pending", "Processing"].includes(item.status)) {
      return res.json({ success: false, message: "Item cannot be cancelled" });
    }
 
   await restoreStock(item.variantId, item.quantity);
    item.status       = "Cancelled";
    item.cancelReason = reason || null;

    
    const activeItems = order.items.filter(i => i.status !== "Cancelled");
    const newItemTotal = activeItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const newShipping  = newItemTotal === 0 ? 0 : newItemTotal >= 499 ? 0 : 49;
    const newTax       = Math.round(newItemTotal * 0); 
    order.itemTotal    = newItemTotal;
    order.shippingCharge = newShipping;
    order.tax          = newTax;
    order.finalTotal   = newItemTotal - order.discount + newTax + newShipping;

    
    const allCancelled = order.items.every(i => i.status === "Cancelled");
    if (allCancelled) {
      order.status     = "Cancelled";
      order.finalTotal = 0;
    }

    await order.save();
    res.json({ success: true, message: "Item cancelled" });
  } catch (err) {
    console.error("cancelOrderItem error:", err);
    res.json({ success: false, message: "Something went wrong" });
  }
};
 

/* ── POST /orders/:id/return ─────────────────────────────────────────── */
export const returnOrder = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.json({ success: false, message: "Please provide a reason for return (min 5 characters)" });
    }

    const order = await Order.findById(req.params.id);
    if (!order || String(order.userId) !== String(req.user._id)) {
      return res.json({ success: false, message: "Order not found" });
    }

    
    if (order.status !== "Delivered") {
      return res.json({ success: false, message: "Only delivered orders can be returned" });
    }

    
    for (const item of order.items) {
      if (item.status === "Delivered") {
item.status = "Return Requested";
        item.returnReason = reason.trim();
        await restoreStock(item.variantId, item.quantity);
      }
    }

    
order.status = "Return Requested";
    order.returnReason = reason.trim();

    
    order.itemTotal      = 0;
    order.shippingCharge = 0;
    order.tax            = 0;
    order.finalTotal     = 0;

    await order.save();

    res.json({ success: true, message: "Return request submitted successfully" });
  } catch (err) {
    console.error("returnOrder error:", err);
    res.json({ success: false, message: "Something went wrong" });
  }
};
 
/* ── GET /orders/:id/invoice ─────────────────────────────────────────── */
export const downloadInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || String(order.userId) !== String(req.user._id)) {
      return res.redirect("/orders");
    }
 
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${order.orderId}.pdf`);
    doc.pipe(res);
 
    
    doc.fontSize(20).font("Helvetica-Bold").text("Cake O'Clock", { align: "center" });
    doc.fontSize(10).font("Helvetica").text("Invoice", { align: "center" });
    doc.moveDown();
    doc.fontSize(10).text(`Order ID: ${order.orderId}`);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}`);
    doc.text(`Payment: ${order.paymentMethod} (${order.paymentStatus})`);
    doc.moveDown();
 
    
    const a = order.address;
    doc.font("Helvetica-Bold").text("Delivery Address:");
    doc.font("Helvetica").text(`${a.name}, ${a.phone}`);
    doc.text(`${a.street}, ${a.city}, ${a.state} - ${a.pincode}`);
    doc.moveDown();
 
    

const invoiceItems = order.items.filter(i => !["Cancelled", "Returned"].includes(i.status));  
 const invoiceItemTotal = invoiceItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const invoiceShipping  = invoiceItems.length === 0 ? 0 : order.shippingCharge;
    const invoiceTax       = order.tax;
    const invoiceFinal     = Math.max(0, invoiceItemTotal - (order.discount || 0) + invoiceTax + invoiceShipping);
 doc.font("Helvetica-Bold").text("Items:", { underline: true });
    doc.moveDown(0.3);
    invoiceItems.forEach((item, i) => {
      doc.font("Helvetica")
        .text(`${i + 1}. ${item.productName} (${item.weight}g) x${item.quantity}  —  ₹${(item.price * item.quantity).toLocaleString("en-IN")}`);
    });

    
    const returnedItems = order.items.filter(i => i.status === "Returned");
    if (returnedItems.length > 0) {
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fillColor("#6a2fc2").text("Returned Items:", { underline: true });
      doc.fillColor("black");
      doc.moveDown(0.3);
      returnedItems.forEach((item, i) => {
        doc.font("Helvetica").fillColor("#888888")
          .text(`${i + 1}. ${item.productName} (${item.weight}g) x${item.quantity}  —  RETURNED${item.returnReason ? " (" + item.returnReason + ")" : ""}`);
      });
      doc.fillColor("black");
    }

    doc.moveDown();
    doc.font("Helvetica").text(`Item Total:      ₹${invoiceItemTotal.toLocaleString("en-IN")}`);    if (order.discount)      doc.text(`Discount:        -₹${order.discount.toLocaleString("en-IN")}`);
if (order.discount)   doc.text(`Discount:        -₹${order.discount.toLocaleString("en-IN")}`);
    if (invoiceTax)       doc.text(`Tax:             ₹${invoiceTax.toLocaleString("en-IN")}`);
    doc.text(`Shipping:        ₹${invoiceShipping.toLocaleString("en-IN")}`);
    doc.font("Helvetica-Bold").text(`Total:           ₹${invoiceFinal.toLocaleString("en-IN")}`); 
    doc.moveDown(2);
    doc.font("Helvetica").fontSize(9).fillColor("gray").text("Thank you for shopping with Cake O'Clock!", { align: "center" });
 
    doc.end();
  } catch (err) {
    console.error("downloadInvoice error:", err);
    res.redirect("/orders");
  }
};
 /* ── POST /orders/item/return ─────────────────────────────────────────── */
export const returnOrderItem = async (req, res) => {
  try {
    const { orderId, itemId, reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.json({ success: false, message: "Please provide a reason (min 5 characters)" });
    }

    const order = await Order.findById(orderId);
    if (!order || String(order.userId) !== String(req.user._id)) {
      return res.json({ success: false, message: "Order not found" });
    }

    const item = order.items.id(itemId);
    if (!item) return res.json({ success: false, message: "Item not found" });

    if (item.status !== "Delivered") {
      return res.json({ success: false, message: "Only delivered items can be returned" });
    }


item.status = "Return Requested";
    item.returnReason = reason.trim();
    await restoreStock(item.variantId, item.quantity);

    
const allReturned = order.items.every(
  i => i.status === "Return Requested"
);
if (allReturned) {
  order.status = "Return Requested";
}
    
    const activeItems    = order.items.filter(i => !["Cancelled", "Returned"].includes(i.status));
    const newItemTotal   = activeItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const newShipping    = newItemTotal === 0 ? 0 : newItemTotal >= 499 ? 0 : 49;
    const newTax         = Math.round(newItemTotal * 0);
    order.itemTotal      = newItemTotal;
    order.shippingCharge = newShipping;
    order.tax            = newTax;
    order.finalTotal     = allReturned ? 0 : newItemTotal - (order.discount || 0) + newTax + newShipping;

    await order.save();
    res.json({ success: true, message: "Return request submitted successfully" });
  } catch (err) {
    console.error("returnOrderItem error:", err);
    res.json({ success: false, message: "Something went wrong" });
  }
};
/* ── Helper: restore stock to last active batch ─────────────────────── */
async function restoreStock(variantId, quantity) {
  const batch = await Batch.findOne({
    variantId,
    status: { $in: ["active", "exhausted"] }
  }).sort({ manufacturedAt: -1 });
 
  if (batch) {
    batch.availableStock += quantity;
    if (batch.status === "exhausted") batch.status = "active";
    await batch.save();
  }
}

export const getOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .select('status updatedAt')
      .lean();

    if (!order || String(order.userId) !== String(req.user._id)) {
      return res.status(404).json({ success: false });
    }

    return res.json({
      success:   true,
      status:    order.status,
      updatedAt: order.updatedAt,
    });
  } catch (err) {
    console.error('getOrderStatus error:', err);
    res.status(500).json({ success: false });
  }
};
