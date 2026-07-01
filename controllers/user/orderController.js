import Order from "../../models/orderModel.js";
import Batch from "../../models/batchModel.js";
import PDFDocument from "pdfkit";
import User from "../../models/userModel.js";
import WalletTransaction from "../../models/walletModel.js";
import Coupon from "../../models/couponModel.js";
 
/* ── GET /orders ────────────────────────────────────────────────────── */
export const listOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const page   = parseInt(req.query.page) || 1;
    const limit  = 8;
    const search = req.query.search?.trim() || "";
 
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
 
    const refundAmount   = order.finalTotal || order.itemTotal || 0;
    order.status         = "Cancelled";
    order.cancelReason   = reason || null;
    order.cancelledAt    = new Date();   
    order.finalTotal     = 0;
    order.itemTotal      = 0;
    order.shippingCharge = 0;
    order.tax            = 0;
    await order.save();
 
    if (["Razorpay", "Wallet", "Online"].includes(order.paymentMethod) && order.paymentStatus === "Paid") {
      if (refundAmount > 0) {
        const user = await User.findById(order.userId);
        const newBalance = (user.walletBalance || 0) + refundAmount;
        await User.findByIdAndUpdate(order.userId, { walletBalance: newBalance });
        await WalletTransaction.create({
          userId:       order.userId,
          type:         "credit",
          amount:       refundAmount,
          description:  `Refund for cancelled order ${order.orderId}`,
          orderId:      order._id,
          balanceAfter: newBalance
        });
      }
    }
 
    res.json({ success: true, message: "Order cancelled successfully" });
  } catch (err) {
    console.error("cancelOrder error:", err);
    res.json({ success: false, message: "Something went wrong" });
  }
};
 
/* ── POST /orders/item/cancel ───────────────────────────────────────── */
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
 
    const activeItems  = order.items.filter(i => i.status !== "Cancelled");
    const newItemTotal = activeItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const newShipping  = newItemTotal === 0 ? 0 : newItemTotal >= 499 ? 0 : 49;
    const newTax       = Math.round(newItemTotal * 0);
 
    // Re-check the coupon's minPurchase against the new total
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
 
    order.itemTotal      = newItemTotal;
    order.discount       = newDiscount;
    order.shippingCharge = newShipping;
    order.tax            = newTax;
    order.finalTotal     = newItemTotal - newDiscount + newTax + newShipping;
 
    const allCancelled = order.items.every(i => i.status === "Cancelled");
    if (allCancelled) {
      order.status      = "Cancelled";
      order.cancelledAt = new Date();   // ← track cancellation date
      order.finalTotal  = 0;
    }
 
    await order.save();
 
    if (["Razorpay", "Wallet", "Online"].includes(order.paymentMethod) && order.paymentStatus === "Paid") {
      const refundAmount = item.price * item.quantity;
      if (refundAmount > 0) {
        const user = await User.findById(order.userId);
        const newBalance = (user.walletBalance || 0) + refundAmount;
        await User.findByIdAndUpdate(order.userId, { walletBalance: newBalance });
        await WalletTransaction.create({
          userId:       order.userId,
          type:         "credit",
          amount:       refundAmount,
          description:  `Refund for cancelled item ${item.productName} (Order: ${order.orderId})`,
          orderId:      order._id,
          balanceAfter: newBalance
        });
      }
    }
 
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
 
    if (!reason || !reason.trim()) {
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
        item.status       = "Return Requested";
        item.returnReason = reason.trim();
        await restoreStock(item.variantId, item.quantity);
      }
    }
 
    order.status         = "Return Requested";
    order.returnReason   = reason.trim();
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
 
    // ── only allow invoice download for delivered orders ──────────
    if (order.status !== "Delivered") {
      return res.status(403).json({ success: false, message: "Invoice is only available for delivered orders." });
    }
 
    // ── colours ───────────────────────────────────────────────────
    const ROSE    = "#C97B8A";
    const ROSE_DK = "#A85F6E";
    const ROSE_LT = "#FAE8ED";
    const BROWN   = "#5C3A3A";
    const MUTED   = "#B08A8A";
    const BORDER  = "#F5D8E0";
    const BLUSH   = "#FDF0F3";
    const GREEN   = "#2A7D3A";
    const WHITE   = "#FFFFFF";
 
    // ── invoice data ──────────────────────────────────────────────
    const invoiceItems     = order.items.filter(i => !["Cancelled", "Returned"].includes(i.status));
    const returnedItems    = order.items.filter(i => i.status === "Returned");
    const cancelledItems   = order.items.filter(i => i.status === "Cancelled");

    const invoiceItemTotal = invoiceItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const invoiceShipping  = invoiceItems.length === 0 ? 0 : order.shippingCharge;
    const invoiceTax       = order.tax || 0;
    const invoiceDiscount  = order.discount || 0;
    const invoiceFinal     = Math.max(0, invoiceItemTotal - invoiceDiscount + invoiceTax + invoiceShipping);
 
    // ── page setup ────────────────────────────────────────────────
    const doc = new PDFDocument({ margin: 0, size: "A4" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${order.orderId}.pdf`);
    doc.pipe(res);
 
    const PW  = doc.page.width;   // 595
    const PH  = doc.page.height;  // 841
    const PAD = 40;
 
    // ═════════════════════════════════════════════════════════════
    // HEADER BAND
    // ═════════════════════════════════════════════════════════════
    doc.rect(0, 0, PW, 100).fill(ROSE);
 
    // subtle lighter left overlay
    doc.save();
    doc.rect(0, 0, PW / 2, 100).fillOpacity(0.12).fill(WHITE);
    doc.fillOpacity(1).restore();
 
    // brand icon circle
    doc.circle(PAD + 22, 50, 22).fill(WHITE).fillOpacity(0.2);
    doc.fillOpacity(1);
 
    // brand name
    doc.font("Helvetica-Bold")
       .fontSize(20)
       .fillColor(WHITE)
       .text("Cake O'Clock", PAD + 52, 28);
 
    doc.font("Helvetica")
       .fontSize(9)
       .fillColor(WHITE)
       .fillOpacity(0.72)
       .text("Fresh baked, delivered with love", PAD + 52, 52);
    doc.fillOpacity(1);
 
    // invoice badge (top-right)
    const badgeX = PW - PAD - 130;
    doc.roundedRect(badgeX, 18, 130, 62, 6)
       .fillOpacity(0.15).fill(WHITE);
    doc.fillOpacity(1);
 
    doc.font("Helvetica")
       .fontSize(8)
       .fillColor(WHITE)
       .fillOpacity(0.65)
       .text("TAX INVOICE", badgeX + 8, 28, { width: 114, align: "right" });
    doc.fillOpacity(1);
 
    doc.font("Helvetica-Bold")
       .fontSize(9.5)
       .fillColor(WHITE)
       .text(order.orderId, badgeX + 8, 46, { width: 114, align: "right" });
 
    const invDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric"
    });
    doc.font("Helvetica")
       .fontSize(8)
       .fillColor(WHITE)
       .fillOpacity(0.72)
       .text(invDate, badgeX + 8, 62, { width: 114, align: "right" });
    doc.fillOpacity(1);
 
    // ═════════════════════════════════════════════════════════════
    // META SECTION  (two blush boxes side by side)
    // ═════════════════════════════════════════════════════════════
    let y = 116;
    const boxW = (PW - PAD * 2 - 10) / 2;
 
    // ── left box: Invoice details ─────────────────────────────────
    doc.roundedRect(PAD, y, boxW, 88, 6).fill(BLUSH);
    let bx = PAD + 12;
    let by = y + 10;
 
    doc.font("Helvetica-Bold").fontSize(7).fillColor(ROSE)
       .text("INVOICE DETAILS", bx, by, { characterSpacing: 0.8 });
    by += 15;
 
    [
      ["Invoice date",   invDate],
      ["Payment method", order.paymentMethod],
      ["Status",         order.paymentStatus],
    ].forEach(([lbl, val]) => {
      doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(lbl, bx, by);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(BROWN)
         .text(String(val), bx + 85, by, { width: boxW - 100 });
      by += 17;
    });
 
    // ── right box: Customer ───────────────────────────────────────
    const rx = PAD + boxW + 10;
    doc.roundedRect(rx, y, boxW, 88, 6).fill(BLUSH);
    bx = rx + 12;
    by = y + 10;
 
    doc.font("Helvetica-Bold").fontSize(7).fillColor(ROSE)
       .text("CUSTOMER", bx, by, { characterSpacing: 0.8 });
    by += 15;
 
    const a = order.address;
    [
      ["Name",    a.name],
      ["Phone",   a.phone],
      ["Address", `${a.city}, ${a.state} - ${a.pincode}`],
    ].forEach(([lbl, val]) => {
      doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(lbl, bx, by);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(BROWN)
         .text(String(val), bx + 60, by, { width: boxW - 74, ellipsis: true });
      by += 17;
    });
 
    y += 102;
 
    // ── divider ───────────────────────────────────────────────────
    doc.moveTo(PAD, y).lineTo(PW - PAD, y).lineWidth(0.5).stroke(BORDER);
    y += 14;
 
    // ═════════════════════════════════════════════════════════════
    // ITEMS SECTION
    // ═════════════════════════════════════════════════════════════
    doc.font("Helvetica-Bold").fontSize(7).fillColor(ROSE)
       .text("ORDER ITEMS", PAD, y, { characterSpacing: 0.8 });
 
    // item count pill
    const pillLabel = `${invoiceItems.length} item${invoiceItems.length !== 1 ? "s" : ""}`;
    const pillW     = doc.widthOfString(pillLabel) + 16;
    doc.roundedRect(PW - PAD - pillW, y - 2, pillW, 14, 7).fill(ROSE_LT);
    doc.font("Helvetica").fontSize(7.5).fillColor(ROSE_DK)
       .text(pillLabel, PW - PAD - pillW + 6, y + 1);
 
    y += 18;
 
    // ── column header ─────────────────────────────────────────────
    const tableW = PW - PAD * 2;
    doc.rect(PAD, y, tableW, 22).fill(ROSE);
 
    const C = {
      product:  { x: PAD + 10,  w: 230 },
      qty:      { x: PAD + 245, w: 45  },
      price:    { x: PAD + 295, w: 90  },
      subtotal: { x: PAD + 390, w: tableW - 390 - 6 },
    };
 
    doc.font("Helvetica-Bold").fontSize(8).fillColor(WHITE);
    doc.text("PRODUCT",  C.product.x,  y + 7);
    doc.text("QTY",      C.qty.x,      y + 7, { width: C.qty.w,      align: "center" });
    doc.text("PRICE",    C.price.x,    y + 7, { width: C.price.w,    align: "center" });
    doc.text("SUBTOTAL", C.subtotal.x, y + 7, { width: C.subtotal.w, align: "right"  });
    y += 22;
 
    // ── item rows ─────────────────────────────────────────────────
    invoiceItems.forEach((item, idx) => {
      const rowH = 34;
      doc.rect(PAD, y, tableW, rowH).fill(idx % 2 === 0 ? WHITE : BLUSH);
 
      // rose dot bullet
      doc.circle(PAD + 10, y + 17, 4).fill(ROSE);
 
      // name + weight
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(BROWN)
         .text(item.productName, PAD + 20, y + 7, { width: C.product.w - 16, ellipsis: true });
      if (item.weight) {
        doc.font("Helvetica").fontSize(7.5).fillColor(MUTED)
           .text(`${item.weight}g`, PAD + 20, y + 20);
      }
 
      // qty
      doc.font("Helvetica-Bold").fontSize(9).fillColor(BROWN)
         .text(String(item.quantity), C.qty.x, y + 13, { width: C.qty.w, align: "center" });
 
      // unit price  ← Rs. instead of ₹ (Helvetica doesn't support ₹)
      doc.font("Helvetica").fontSize(8.5).fillColor(MUTED)
         .text(`Rs.${item.price.toLocaleString("en-IN")}`, C.price.x, y + 13, { width: C.price.w, align: "center" });
 
      // subtotal  ← Rs. instead of ₹
      doc.font("Helvetica-Bold").fontSize(9).fillColor(BROWN)
         .text(`Rs.${(item.price * item.quantity).toLocaleString("en-IN")}`, C.subtotal.x, y + 13, { width: C.subtotal.w, align: "right" });
 
      y += rowH;
    });
 
// ── returned items ────────────────────────────────────────────
    if (returnedItems.length > 0) {
      y += 8;
      doc.font("Helvetica-Bold").fontSize(7).fillColor("#7030C9")
         .text("RETURNED ITEMS", PAD, y, { characterSpacing: 0.8 });
      y += 14;

      returnedItems.forEach(item => {
        doc.rect(PAD, y, tableW, 28).fill("#F3ECFE");
        doc.font("Helvetica").fontSize(8.5).fillColor("#7030C9")
           .text(
             `${item.productName}${item.weight ? ` (${item.weight}g)` : ""} x ${item.quantity}   --   RETURNED${item.returnReason ? "  (" + item.returnReason + ")" : ""}`,
             PAD + 10, y + 9,
             { width: tableW - 20 }
           );
        y += 28;
      });
    }

    // ── cancelled items ──────────────────────────────────────────
    if (cancelledItems.length > 0) {
      y += 8;
      doc.font("Helvetica-Bold").fontSize(7).fillColor("#C0392B")
         .text("CANCELLED ITEMS", PAD, y, { characterSpacing: 0.8 });
      y += 14;

      cancelledItems.forEach(item => {
        const reason = item.cancelReason || order.cancelReason;
        doc.rect(PAD, y, tableW, 28).fill("#FBE5E5");
        doc.font("Helvetica").fontSize(8.5).fillColor("#C0392B")
           .text(
             `${item.productName}${item.weight ? ` (${item.weight}g)` : ""} x ${item.quantity}   --   CANCELLED${reason ? "  (" + reason + ")" : ""}`,
             PAD + 10, y + 9,
             { width: tableW - 20 }
           );
        y += 28;
      });
    }

    y += 12;
    doc.moveTo(PAD, y).lineTo(PW - PAD, y).lineWidth(0.5).stroke(BORDER);
    y += 16;
 
    // ═════════════════════════════════════════════════════════════
    // PAYMENT SUMMARY BOX
    // ═════════════════════════════════════════════════════════════
    doc.font("Helvetica-Bold").fontSize(7).fillColor(ROSE)
       .text("PAYMENT SUMMARY", PAD, y, { characterSpacing: 0.8 });
    y += 16;
 
    const summaryRows = [
      ["Item total", `Rs.${invoiceItemTotal.toLocaleString("en-IN")}`, BROWN],
    ];
    if (invoiceDiscount > 0) {
      summaryRows.push(["Discount", `-Rs.${invoiceDiscount.toLocaleString("en-IN")}`, GREEN]);
    }
    if (order.couponCode) {
      summaryRows.push([`Coupon  (${order.couponCode})`, "Applied", ROSE_DK]);
    }
    if (invoiceTax > 0) {
      summaryRows.push(["Tax", `Rs.${invoiceTax.toLocaleString("en-IN")}`, BROWN]);
    }
    summaryRows.push([
      "Shipping",
      invoiceShipping === 0 ? "Free" : `Rs.${invoiceShipping.toLocaleString("en-IN")}`,
      invoiceShipping === 0 ? GREEN : BROWN
    ]);
 
    const rowH2 = 22;
    const boxH  = summaryRows.length * rowH2 + 54;
    doc.roundedRect(PAD, y, tableW, boxH, 8).fill(BLUSH);
 
    let sy = y + 12;
    const lx = PAD + 16;
 
    summaryRows.forEach(([lbl, val, color]) => {
      doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(lbl, lx, sy);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(color)
         .text(val, lx, sy, { width: tableW - 32, align: "right" });
      sy += rowH2;
    });
 
    // inner divider
    doc.moveTo(PAD + 14, sy + 2).lineTo(PW - PAD - 14, sy + 2).lineWidth(0.5).stroke(BORDER);
    sy += 12;
 
    // grand total  ← Rs. instead of ₹
    doc.font("Helvetica-Bold").fontSize(13).fillColor(BROWN)
       .text("Grand total", lx, sy);
    doc.font("Helvetica-Bold").fontSize(17).fillColor(ROSE)
       .text(`Rs.${invoiceFinal.toLocaleString("en-IN")}`, lx, sy - 3, { width: tableW - 32, align: "right" });
 
    y += boxH + 18;
 
    // ═════════════════════════════════════════════════════════════
    // FOOTER
    // ═════════════════════════════════════════════════════════════
    const footerY = Math.max(y + 16, PH - 64);
 
    doc.moveTo(PAD, footerY).lineTo(PW - PAD, footerY).lineWidth(0.5).stroke(BORDER);
 
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(ROSE)
       .text("Thank you for choosing Cake O'Clock!", 0, footerY + 14, { align: "center" });
 
    doc.font("Helvetica").fontSize(8).fillColor(MUTED)
       .text("support@cakeoclock.com   .   cakeoclock.com", 0, footerY + 32, { align: "center" });
 
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
 
    if (!reason || !reason.trim()) {
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
 
    item.status       = "Return Requested";
    item.returnReason = reason.trim();
    await restoreStock(item.variantId, item.quantity);
 
    const allReturned = order.items.every(i => i.status === "Return Requested");
    if (allReturned) {
      order.status = "Return Requested";
    }
 
    const activeItems  = order.items.filter(i => !["Cancelled", "Returned"].includes(i.status));
    const newItemTotal = activeItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const newShipping  = newItemTotal === 0 ? 0 : newItemTotal >= 499 ? 0 : 49;
    const newTax       = Math.round(newItemTotal * 0);
 
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
 
    order.itemTotal      = newItemTotal;
    order.discount       = newDiscount;
    order.shippingCharge = newShipping;
    order.tax            = newTax;
    order.finalTotal     = allReturned ? 0 : newItemTotal - newDiscount + newTax + newShipping;
 
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
 
/* ── GET /orders/:id/status ─────────────────────────────────────────── */
export const getOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .select("status updatedAt")
      .lean();
 
    if (!order) {
      return res.status(404).json({ success: false });
    }
 
    return res.json({
      success:   true,
      status:    order.status,
      updatedAt: order.updatedAt,
    });
  } catch (err) {
    console.error("getOrderStatus error:", err);
    res.status(500).json({ success: false });
  }
};