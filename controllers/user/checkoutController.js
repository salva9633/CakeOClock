import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";
import Variant from "../../models/variantModel.js";
import Batch from "../../models/batchModel.js";
import Order from "../../models/orderModel.js";
import User from "../../models/userModel.js";
import Coupon from "../../models/couponModel.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import WalletTransaction from "../../models/walletModel.js";
 
const razorpayInstance = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
 
const TAX_RATE            = 0;
const SHIPPING_FREE_ABOVE = 499;
const SHIPPING_CHARGE     = 49;
 
/* ── GET /checkout ─────────────────────────────────────────────────── */
export const loadCheckout = async (req, res) => {
  try {
    const userId = req.user._id;
 
    const [user, cart] = await Promise.all([
      User.findById(userId),
      Cart.findOne({ userId })
        .populate({ path: "items.productId", select: "productName productImages isListed" })
        .populate({ path: "items.variantId", select: "weight regularPrice imageUrls isAvailable" })
    ]);
 
    if (!cart || cart.items.length === 0) return res.redirect("/cart");
 
    const items = cart.items.filter(item =>
      item.productId?.isListed && item.variantId?.isAvailable
    );
 
    if (items.length === 0) return res.redirect("/cart");


for (const item of items) {

  const batches = await Batch.find({
    variantId:      item.variantId._id || item.variantId,
    status:         "active",
    expiryAt:       { $gt: new Date() },
    availableStock: { $gt: 0 }
  }).lean();

  const totalStock = batches.reduce((s, b) => s + b.availableStock, 0);
  
  console.log(`[checkout stock] variantId: ${item.variantId._id}, qty needed: ${item.quantity}, totalStock: ${totalStock}, batches found: ${batches.length}`);
  if (totalStock < item.quantity) {
    console.log(`[checkout stock] REDIRECTING — insufficient stock for variantId: ${item.variantId._id}`);
    return res.redirect("/cart?error=Some+items+in+your+cart+are+out+of+stock.+Please+review+your+cart.");
  }
}

const itemTotal      = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const tax            = Math.round(itemTotal * TAX_RATE);
    const shippingCharge = itemTotal >= SHIPPING_FREE_ABOVE ? 0 : SHIPPING_CHARGE;
    const finalTotal     = itemTotal + tax + shippingCharge;
 
    const defaultAddress = user.addresses.find(a => a.isDefault) || user.addresses[0] || null;
 
    const previousOrders = await Order.findOne({ userId, status: { $ne: "Cancelled" } });
 
    // ── Fetch valid coupons ──────────────────────────────────────────
  

const allCoupons = await Coupon.find({
  isActive:   true,
  isDeleted:  false,
  expiryDate: { $gte: new Date() }
});

console.log("Raw coupons from DB:", allCoupons.length, allCoupons.map(c => c.code));

const coupons = allCoupons.filter(c => {
  if (c.isFirstOrderOnly && previousOrders) return false;
  if (c.usageLimit > 0 && c.usedBy && c.usedBy.length >= c.usageLimit) return false;
  if (c.assignedTo && String(c.assignedTo) !== String(userId)) return false;
  return true;
});

console.log("Coupons after filter:", coupons.length, coupons.map(c => c.code));

    res.render("checkout", {
      user,
      items,
      addresses:       user.addresses,
      selectedAddress: defaultAddress,
      itemTotal,
      discount:        0,
      tax,
      shippingCharge,
      finalTotal,
      TAX_RATE,
      coupons,
      couponError:     req.query.couponError || null,
       orderError:      req.query.error || null

    });
 
  } catch (err) {
    console.error("loadCheckout error:", err);
    res.redirect("/cart");
  }
};
 
// ================================================================

export const applyCoupon = async (req, res) => {
  try {
    const userId     = req.user._id;
    const { code }   = req.body;
 
    if (!code) {
      return res.json({ success: false, message: "Please enter a coupon code." });
    }
 
    
    const cart = await Cart.findOne({ userId })
      .populate({ path: "items.productId", select: "isListed" })
      .populate({ path: "items.variantId", select: "isAvailable" });
 
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Your cart is empty." });
    }
 
    const validItems = cart.items.filter(
      i => i.productId?.isListed && i.variantId?.isAvailable
    );
    const itemTotal      = validItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const shippingCharge = itemTotal >= SHIPPING_FREE_ABOVE ? 0 : SHIPPING_CHARGE;
 

    

    const coupon = await Coupon.findOne({
      code:       code.trim().toUpperCase(),
      isActive:   true,
      isDeleted:  false,
      expiryDate: { $gte: new Date() }
    });

 
if (!coupon) {
      return res.json({ success: false, message: "Invalid or expired coupon code." });
    }

  
    if (coupon.assignedTo && String(coupon.assignedTo) !== String(userId)) {
      return res.json({ success: false, message: "This coupon is not valid for your account." });
    }


 
    
    if (coupon.minPurchase && itemTotal < coupon.minPurchase) {
      return res.json({
        success: false,
        message: `Minimum order of ₹${coupon.minPurchase} required for this coupon.`
      });
    }
 
    
    let discountAmt = 0;
    if (coupon.discountType === "percentage") {
      discountAmt = (itemTotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount) discountAmt = Math.min(discountAmt, coupon.maxDiscount);
    } else {
      discountAmt = coupon.discountValue;
    }
    discountAmt      = Math.round(Math.min(discountAmt, itemTotal));
    const newTotal   = itemTotal - discountAmt + shippingCharge;
 
    return res.json({
      success:      true,
      discountAmt,
      newTotal,
      shippingCharge,
      itemTotal,
      couponCode:   coupon.code,
      message:      `Coupon applied! You save ₹${discountAmt.toLocaleString("en-IN")}`
    });
 
  } catch (err) {
    console.error("applyCoupon error:", err);
    return res.json({ success: false, message: "Something went wrong. Please try again." });
  }
};
 
// ================================================================

export const removeCoupon = async (req, res) => {
  try {
    const userId = req.user._id;
 
    const cart = await Cart.findOne({ userId })
      .populate({ path: "items.productId", select: "isListed" })
      .populate({ path: "items.variantId", select: "isAvailable" });
 
    const validItems     = cart.items.filter(i => i.productId?.isListed && i.variantId?.isAvailable);
    const itemTotal      = validItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const shippingCharge = itemTotal >= SHIPPING_FREE_ABOVE ? 0 : SHIPPING_CHARGE;
    const newTotal       = itemTotal + shippingCharge;
 
    return res.json({ success: true, itemTotal, shippingCharge, newTotal });
 
  } catch (err) {
    console.error("removeCoupon error:", err);
    return res.json({ success: false, message: "Something went wrong." });
  }
};
 
/* ── GET /payment-page ─────────────────────────────────────────────── */
export const loadPaymentPage = async (req, res) => {
  try {
    const userId = req.user._id;
    const { addressId, couponCode } = req.query;
 
    const [user, cart] = await Promise.all([
      User.findById(userId).select("+walletBalance"),
      Cart.findOne({ userId })
        .populate({ path: "items.productId", select: "productName productImages isListed" })
        .populate({ path: "items.variantId", select: "weight salePrice regularPrice imageUrls isAvailable" })
    ]);
 
    if (!cart || cart.items.length === 0) return res.redirect("/cart");
 
const cartItems = cart.items.filter(item =>
      item.productId?.isListed && item.variantId?.isAvailable
    );

    
    for (const item of cartItems) {

      const batches = await Batch.find({
        variantId:      item.variantId._id || item.variantId,
        status:         "active",
        expiryAt:       { $gt: new Date() },
        availableStock: { $gt: 0 }
      }).lean();

      const totalStock = batches.reduce((s, b) => s + b.availableStock, 0);

      if (totalStock < item.quantity) {
        return res.redirect("/cart?error=Some+items+are+out+of+stock.+Please+review+your+cart.");
      }
    }

    const totalAmount    = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const deliveryCharge = totalAmount >= SHIPPING_FREE_ABOVE ? 0 : SHIPPING_CHARGE;
 
    let couponDiscount = 0;
    let appliedCoupon  = null;
 
    if (couponCode) {
      const coupon = await Coupon.findOne({
        code:       couponCode.toUpperCase(),
        isActive:   true,
        isDeleted:  false,
        expiryDate: { $gte: new Date() }
      });
 
      if (coupon) {
        const limitReached = coupon.usageLimit > 0 && coupon.usedBy && coupon.usedBy.length >= coupon.usageLimit;
        if (!limitReached) {
          if (coupon.discountType === "percentage") {
            couponDiscount = (totalAmount * coupon.discountValue) / 100;
            if (coupon.maxDiscount) couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);
          } else {
            couponDiscount = coupon.discountValue;
          }
          couponDiscount = Math.round(Math.min(couponDiscount, totalAmount));
          appliedCoupon  = coupon;
        }
      }
    }
 
    const finalTotal = totalAmount + deliveryCharge - couponDiscount;
 
    const lastWalletTx = await WalletTransaction.findOne({ userId })
      .sort({ createdAt: -1 })
      .select("balanceAfter");
    const walletBalance = lastWalletTx ? lastWalletTx.balanceAfter : 0;
 
    res.render("paymentPage", {
      user,
      cartItems,
      totalAmount,
      deliveryCharge,
      couponDiscount,
      appliedCoupon,
      finalTotal,
      addressId,
      couponCode,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      walletBalance
    });
 
  } catch (err) {
    console.log("loadPaymentPage error:", err);
    res.redirect("/checkout");
  }
};
 

/* ── POST /checkout/place (COD + Wallet) ───────────────────────────── */
export const placeOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { addressId, paymentMethod = "COD", couponCode } = req.body;
  
    const user = await User.findById(userId);
    const addr = user.addresses.id(addressId);
    if (!addr) return res.send("Invalid address");
 
    const cart = await Cart.findOne({ userId })
      .populate({ path: "items.productId", select: "productName productImages isListed" })
      .populate({ path: "items.variantId", select: "weight salePrice regularPrice imageUrls isAvailable" });
 
    if (!cart || cart.items.length === 0) return res.send("Cart is empty");
 
    const orderItems = [];
    const orderedItemIds = []; 
    for (const item of cart.items) {
      if (!item.productId?.isListed || !item.variantId?.isAvailable) continue;
      const batches    = await Batch.find({ variantId: item.variantId._id, status: "active", expiryAt: { $gt: new Date() }, availableStock: { $gt: 0 } }).sort({ manufacturedAt: 1 });
      const totalStock = batches.reduce((s, b) => s + b.availableStock, 0);
      if (totalStock < item.quantity) {
        return res.status(400).json({ success: false, message: `"${item.productId.productName}" is out of stock.` });
      }

      orderItems.push({
        productId:    item.productId._id,
        variantId:    item.variantId._id,
        productName:  item.productId.productName,
        productImage: item.variantId.imageUrls?.[0] || item.productId.productImages?.[0] || "",
        weight:       item.variantId.weight,
        quantity:     item.quantity,
        price:        item.price,
        regularPrice: item.variantId.regularPrice
      });
      orderedItemIds.push(item._id);
    }
 
    if (orderItems.length === 0) return res.redirect("/cart?error=No+valid+items+to+order");

    for (const item of orderItems) {
      let remaining = item.quantity;
      const batches = await Batch.find({ variantId: item.variantId, status: "active", availableStock: { $gt: 0 } }).sort({ manufacturedAt: 1 });
      for (const batch of batches) {
        if (remaining <= 0) break;
        const deduct = Math.min(batch.availableStock, remaining);
        batch.availableStock -= deduct;
        if (batch.availableStock === 0) batch.status = "exhausted";
        await batch.save();
        remaining -= deduct;
      }
    }
 
    const itemTotal      = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const tax            = Math.round(itemTotal * TAX_RATE);
    const shippingCharge = itemTotal >= SHIPPING_FREE_ABOVE ? 0 : SHIPPING_CHARGE;
 
    let discount   = 0;
    let usedCoupon = null;
    let couponDoc  = null;
 
if (couponCode) {
      couponDoc = await Coupon.findOne({
        code:       couponCode.toUpperCase(),
        isActive:   true,
        isDeleted:  false,
        expiryDate: { $gte: new Date() }
      });

      if (couponDoc) {
        if (couponDoc.assignedTo && String(couponDoc.assignedTo) !== String(userId)) {
          return res.redirect(`/checkout?couponError=This+coupon+is+not+valid+for+your+account`);
        }
       
        if (couponDoc.isFirstOrderOnly) {
          const previousOrders = await Order.findOne({ userId, status: { $ne: "Cancelled" } });
          if (previousOrders) return res.redirect(`/checkout?couponError=This+coupon+is+only+valid+for+your+first+order`);
        }

        if (couponDoc.discountType === "percentage") {
          discount = (itemTotal * couponDoc.discountValue) / 100;
          if (couponDoc.maxDiscount) discount = Math.min(discount, couponDoc.maxDiscount);
        } else {
          discount = couponDoc.discountValue;
        }
        discount   = Math.round(Math.min(discount, itemTotal));
        usedCoupon = couponDoc.code;
      }
    } 
 const finalTotal = itemTotal - discount + tax + shippingCharge;

    if (finalTotal <= 0) {
      return res.redirect("/checkout?error=Order+amount+is+invalid.+Please+contact+support.");
    }

    if (paymentMethod === "COD" && finalTotal > 1000) {
      return res.redirect("/checkout?error=COD+not+available+for+orders+above+%E2%82%B91000");
    }
 
    if (paymentMethod === "Wallet") {
      const lastTx = await WalletTransaction.findOne({ userId })
        .sort({ createdAt: -1 })
        .select("balanceAfter");
      const currentBalance = lastTx ? lastTx.balanceAfter : 0;
 
      if (currentBalance < finalTotal) {
        return res.redirect(
          `/payment-page?addressId=${addressId}&couponCode=${couponCode || ""}&error=Insufficient+wallet+balance`
        );
      }
 
      const newWalletBalance = currentBalance - finalTotal;
      await User.findByIdAndUpdate(userId, { $set: { walletBalance: newWalletBalance } });
      await WalletTransaction.create({
        userId,
        type:         "debit",
        amount:       finalTotal,
        description:  "Order payment via Wallet",
        balanceAfter: newWalletBalance
      });
    }
 
    const order = await Order.create({
      userId,
      address: {
        name: addr.name, phone: addr.phone, street: addr.street,
        address: addr.address, landmark: addr.landmark,
        city: addr.city, state: addr.state, pincode: addr.pincode, type: addr.type
      },
      items:         orderItems,
      paymentMethod,
      paymentStatus: paymentMethod === "COD" ? "Pending" : "Paid",
      itemTotal,
      discount,
      couponCode:    usedCoupon,
      tax,
      shippingCharge,
      finalTotal,
      status:        "Pending"
    });
 
    if (usedCoupon && couponDoc) {
      await Coupon.findByIdAndUpdate(couponDoc._id, { $push: { usedBy: userId } });
    }
 
    if (paymentMethod === "Wallet") {
      await WalletTransaction.findOneAndUpdate(
        { userId, orderId: null, type: "debit", description: "Order payment via Wallet" },
        { orderId: order._id },
        { sort: { createdAt: -1 } }
      );
    }
 
    await Cart.findOneAndUpdate(
      { userId },
      { $pull: { items: { _id: { $in: orderedItemIds } } } }
    );
    return res.redirect(`/order-success/${order._id}`);
 
  } catch (err) {
    console.error("placeOrder error:", err);
    return res.send(err.message);
  }
};
 
/* ── POST /checkout/create-razorpay-order ──────────────────────────── */
export const createRazorpayOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid order amount" });
    }

    const options = {
      amount:   Math.round(amount * 100),
      currency: "INR",
      receipt:  `receipt_${Date.now()}`,
    };
    const order = await razorpayInstance.orders.create(options);
    res.status(200).json({
      success:  true,
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
    });
  } catch (err) {
  console.error("========== RAZORPAY ERROR ==========");
  console.error(err);
  console.error(err.error);
  console.error(err.message);
  console.error(err.stack);

  return res.status(500).json({
    success: false,
    message: "Failed to create Razorpay order"
  });
}
};
 

/* ── POST /checkout/verify-razorpay-payment ────────────────────────── */
export const verifyRazorpayPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      addressId,
      couponCode,
    } = req.body;
 
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
 
    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }
 
    const user = await User.findById(userId);
    const addr = user.addresses.id(addressId);
    if (!addr) return res.status(400).json({ success: false, message: "Invalid address" });
 
    const cart = await Cart.findOne({ userId })
      .populate({ path: "items.productId", select: "productName productImages isListed" })
      .populate({ path: "items.variantId", select: "weight salePrice regularPrice imageUrls isAvailable" });
 
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }
 
    const orderItems = [];
    const orderedItemIds = []; // tracks which cart rows actually got ordered
    for (const item of cart.items) {
      if (!item.productId?.isListed || !item.variantId?.isAvailable) continue;
 
      const batches    = await Batch.find({ variantId: item.variantId._id, status: "active", expiryAt: { $gt: new Date() }, availableStock: { $gt: 0 } }).sort({ manufacturedAt: 1 });
      const totalStock = batches.reduce((s, b) => s + b.availableStock, 0);
      if (totalStock < item.quantity) {
        return res.status(400).json({ success: false, message: `"${item.productId.productName}" is out of stock.` });
      }

      orderItems.push({
        productId:    item.productId._id,
        variantId:    item.variantId._id,
        productName:  item.productId.productName,
        productImage: item.variantId.imageUrls?.[0] || item.productId.productImages?.[0] || "",
        weight:       item.variantId.weight,
        quantity:     item.quantity,
        price:        item.price,
        regularPrice: item.variantId.regularPrice
      });
      orderedItemIds.push(item._id);
    }
 
    if (orderItems.length === 0) {
      return res.status(400).json({ success: false, message: "No valid items" });
    }
 
    for (const item of orderItems) {
      let remaining = item.quantity;
      const batches = await Batch.find({ variantId: item.variantId, status: "active", availableStock: { $gt: 0 } }).sort({ manufacturedAt: 1 });
      for (const batch of batches) {
        if (remaining <= 0) break;
        const deduct = Math.min(batch.availableStock, remaining);
        batch.availableStock -= deduct;
        if (batch.availableStock === 0) batch.status = "exhausted";
        await batch.save();
        remaining -= deduct;
      }
    }
 
    const itemTotal      = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const tax            = Math.round(itemTotal * TAX_RATE);
    const shippingCharge = itemTotal >= SHIPPING_FREE_ABOVE ? 0 : SHIPPING_CHARGE;
 
    let discount   = 0;
    let usedCoupon = null;
    let couponDoc  = null;
 
    if (couponCode) {
      couponDoc = await Coupon.findOne({
        code:       couponCode.toUpperCase(),
        isActive:   true,
        isDeleted:  false,
        expiryDate: { $gte: new Date() }
      });
   if (couponDoc) {
        if (couponDoc.assignedTo && String(couponDoc.assignedTo) !== String(userId)) {
          couponDoc = null;
       
        } else {
          if (couponDoc.discountType === "percentage") {
            discount = (itemTotal * couponDoc.discountValue) / 100;
            if (couponDoc.maxDiscount) discount = Math.min(discount, couponDoc.maxDiscount);
          } else {
            discount = couponDoc.discountValue;
          }
        discount   = Math.round(Math.min(discount, itemTotal));
          usedCoupon = couponDoc.code;
        }
      }
    }
 
    const finalTotal = itemTotal - discount + tax + shippingCharge;

    if (finalTotal <= 0) {
      return res.status(400).json({ success: false, message: "Invalid order amount" });
    }
 
    const order = await Order.create({
      userId,
      address: {
        name: addr.name, phone: addr.phone, street: addr.street,
        address: addr.address, landmark: addr.landmark,
        city: addr.city, state: addr.state, pincode: addr.pincode, type: addr.type
      },
      items:             orderItems,
      paymentMethod:     "Razorpay",
      paymentStatus:     "Paid",
      razorpayOrderId:   razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      itemTotal,
      discount,
      couponCode:        usedCoupon,
      tax,
      shippingCharge,
      finalTotal,
      status:            "Pending",
    });
 
    if (usedCoupon && couponDoc) {
      await Coupon.findByIdAndUpdate(couponDoc._id, { $push: { usedBy: userId } });
    }
 
    await Cart.findOneAndUpdate(
      { userId },
      { $pull: { items: { _id: { $in: orderedItemIds } } } }
    );
    res.status(200).json({ success: true, orderId: order._id });
 
  } catch (err) {
    console.error("verifyRazorpayPayment error:", err);
    res.status(500).json({ success: false, message: "Server error during payment verification" });
  }
};
 
/* ── POST /checkout/razorpay-failure ───────────────────────────────── */
export const razorpayFailure = async (req, res) => {
  try {
    const userId = req.user._id;
    const { addressId, couponCode, razorpay_order_id, razorpay_payment_id, amount } = req.body;

    const user = await User.findById(userId);
    const addr = user?.addresses?.id(addressId);
    if (!addr) return res.status(400).json({ success: false, message: "Invalid address" });

    const cart = await Cart.findOne({ userId })
      .populate({ path: "items.productId", select: "productName productImages isListed" })
      .populate({ path: "items.variantId", select: "weight salePrice regularPrice imageUrls isAvailable" });

    if (!cart || cart.items.length === 0)
      return res.status(400).json({ success: false, message: "Cart is empty" });

    const orderItems = cart.items
      .filter(i => i.productId?.isListed && i.variantId?.isAvailable)
      .map(item => ({
        productId:    item.productId._id,
        variantId:    item.variantId._id,
        productName:  item.productId.productName,
        productImage: item.variantId.imageUrls?.[0] || item.productId.productImages?.[0] || "",
        weight:       item.variantId.weight,
        quantity:     item.quantity,
        price:        item.price,
        regularPrice: item.variantId.regularPrice
      }));

    if (orderItems.length === 0)
      return res.status(400).json({ success: false, message: "No valid items" });

    const itemTotal      = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const shippingCharge = itemTotal >= SHIPPING_FREE_ABOVE ? 0 : SHIPPING_CHARGE;
    const tax            = Math.round(itemTotal * TAX_RATE);

    let discount = 0;
    if (couponCode) {
      const couponDoc = await Coupon.findOne({
        code: couponCode.toUpperCase(), isActive: true,
        isDeleted: false, expiryDate: { $gte: new Date() }
      });
      if (couponDoc) {
        discount = couponDoc.discountType === "percentage"
          ? Math.min((itemTotal * couponDoc.discountValue) / 100, couponDoc.maxDiscount || Infinity)
          : couponDoc.discountValue;
        discount = Math.round(Math.min(discount, itemTotal));
      }
    }

    const finalTotal = itemTotal - discount + tax + shippingCharge;

    await Order.create({
      userId,
      address: {
        name: addr.name, phone: addr.phone, street: addr.street,
        address: addr.address, landmark: addr.landmark,
        city: addr.city, state: addr.state, pincode: addr.pincode, type: addr.type
      },
      items:             orderItems,
      paymentMethod:     "Razorpay",
      paymentStatus:     "Failed",       // ← key field
      razorpayOrderId:   razorpay_order_id || "",
      razorpayPaymentId: razorpay_payment_id || "",
      itemTotal, discount, tax, shippingCharge, finalTotal,
      status: "Pending"
    });

    res.status(200).json({ success: true, message: "Failed order recorded" });
  } catch (err) {
    console.error("razorpayFailure error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── GET /payment-failed ───────────────────────────────────────────── */
export const loadPaymentFailed = (req, res) => {
  const { addressId, couponCode, reason } = req.query;
  res.render("paymentFailed", {
    addressId:  addressId  || "",
    couponCode: couponCode || "",
    reason:     reason     || "Unfortunately, your payment could not be processed."
  });
};
 
/* ── GET /order-success/:id ─────────────────────────────────────────── */
export const orderSuccess = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || String(order.userId) !== String(req.user._id)) {
      return res.redirect("/orders");
    }
    res.render("orderSuccess", { order });
  } catch (err) {
    console.error("orderSuccess error:", err);
    res.redirect("/orders");
  }
};
 /* ── POST /checkout/retry-razorpay-order ─────────────────────────── */
export const retryRazorpayOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);

    if (!order || String(order.userId) !== String(req.user._id)) {
      return res.json({ success: false, message: "Order not found" });
    }

    if (order.paymentStatus !== "Failed" || order.status !== "Pending") {
      return res.json({ success: false, message: "This order is not eligible for retry" });
    }

const razorpayOrder = await razorpayInstance.orders.create({
        amount:   Math.round(order.finalTotal * 100),
      currency: "INR",
      receipt:  order.orderId,
    });

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    return res.json({
      success:        true,
      razorpayOrder,
      razorpayKeyId:  process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("retryRazorpayOrder error:", err);
    return res.json({ success: false, message: "Something went wrong" });
  }
};
/* ── POST /checkout/verify-retry-payment ───────────────────────────── */
export const verifyRetryPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId                  // the existing DB order _id
    } = req.body;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    const order = await Order.findById(orderId);
    if (!order || String(order.userId) !== String(userId)) {
      return res.status(400).json({ success: false, message: "Order not found" });
    }

    // Deduct stock now (was skipped on failure)
    for (const item of order.items) {
      let remaining = item.quantity;
      const batches = await Batch.find({
        variantId:      item.variantId,
        status:         "active",
        availableStock: { $gt: 0 }
      }).sort({ manufacturedAt: 1 });

      for (const batch of batches) {
        if (remaining <= 0) break;
        const deduct = Math.min(batch.availableStock, remaining);
        batch.availableStock -= deduct;
        if (batch.availableStock === 0) batch.status = "exhausted";
        await batch.save();
        remaining -= deduct;
      }
    }

    // Update order to paid
    order.paymentStatus     = "Paid";
    order.razorpayOrderId   = razorpay_order_id;
    order.razorpayPaymentId = razorpay_payment_id;
    await order.save();

    return res.status(200).json({ success: true, orderId: order._id });

  } catch (err) {
    console.error("verifyRetryPayment error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};