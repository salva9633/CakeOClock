import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";
import Variant from "../../models/variantModel.js";
import Batch from "../../models/batchModel.js";
import Order from "../../models/orderModel.js";
import User from "../../models/userModel.js";
 
const TAX_RATE      = 0;     
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
        .populate({ path: "items.variantId", select: "weight salePrice regularPrice imageUrls isAvailable" })
    ]);
 
    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }
 
    
    const items = cart.items.filter(item =>
      item.productId?.isListed &&
      item.variantId?.isAvailable
    );
 
    if (items.length === 0) {
      return res.redirect("/cart");
    }
 
    const itemTotal     = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const discount      = 0;
    const tax           = Math.round(itemTotal * TAX_RATE);
    const shippingCharge = itemTotal >= SHIPPING_FREE_ABOVE ? 0 : SHIPPING_CHARGE;
    const finalTotal    = itemTotal - discount + tax + shippingCharge;
 
    const defaultAddress = user.addresses.find(a => a.isDefault) || user.addresses[0] || null;
 
    res.render("checkout", {
      user,
      items,
      addresses: user.addresses,
      selectedAddress: defaultAddress,
      itemTotal,
      discount,
      tax,
      shippingCharge,
      finalTotal,
      TAX_RATE
    });
  } catch (err) {
    console.error("loadCheckout error:", err);
    res.redirect("/cart");
  }
};

export const loadPaymentPage = async (req, res) => {
  try {

    const userId = req.user._id;
    const { addressId, couponCode } = req.query;

    const [user, cart] = await Promise.all([
      User.findById(userId),

      Cart.findOne({ userId })
        .populate({
          path: "items.productId",
          select: "productName productImages isListed"
        })
        .populate({
          path: "items.variantId",
          select: "weight salePrice regularPrice imageUrls isAvailable"
        })
    ]);

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    const cartItems = cart.items.filter(item =>
      item.productId?.isListed &&
      item.variantId?.isAvailable
    );

    const totalAmount = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const deliveryCharge = totalAmount >= SHIPPING_FREE_ABOVE
      ? 0
      : SHIPPING_CHARGE;

    const finalTotal = totalAmount + deliveryCharge;

    res.render("paymentPage", {
      user,
      cartItems,
      totalAmount: finalTotal,
      deliveryCharge,
      addressId,
      couponCode
    });

  } catch (err) {

    console.log("loadPaymentPage error:", err);
    res.redirect("/checkout");

  }
};
 
/* ── POST /checkout/place ───────────────────────────────────────────── */
export const placeOrder = async (req, res) => {
  try {
    const userId    = req.user._id;
    const { addressId, paymentMethod = "COD" } = req.body;
 
    const user = await User.findById(userId);
    const addr = user.addresses.id(addressId);
    if (!addr) {
      return res.send("Invalid address");
    }
 
    const cart = await Cart.findOne({ userId })
      .populate({ path: "items.productId", select: "productName productImages isListed" })
      .populate({ path: "items.variantId", select: "weight salePrice regularPrice imageUrls isAvailable" });
 
    if (!cart || cart.items.length === 0) {
      return res.send("Cart is empty");
    }
 
    
    const orderItems = [];
    for (const item of cart.items) {
      if (!item.productId?.isListed || !item.variantId?.isAvailable) continue;
 
      const batches = await Batch.find({
        variantId: item.variantId._id,
        status: "active",
        availableStock: { $gt: 0 }
      }).sort({ manufacturedAt: 1 });
 
      const totalStock = batches.reduce((s, b) => s + b.availableStock, 0);
      if (totalStock < item.quantity) {
        return res.send(
          `"${item.productId.productName}" does not have enough stock.`
        );
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
    }
 
    if (orderItems.length === 0) {
      return res.send("No valid items to order");
    }
 
    
    for (const item of orderItems) {
      let remaining = item.quantity;
      const batches = await Batch.find({
        variantId: item.variantId,
        status: "active",
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
 
    const itemTotal      = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const discount       = 0;
    const tax            = Math.round(itemTotal * TAX_RATE);
    const shippingCharge = itemTotal >= SHIPPING_FREE_ABOVE ? 0 : SHIPPING_CHARGE;
    const finalTotal     = itemTotal - discount + tax + shippingCharge;
 
    const order = await Order.create({
      userId,
      address: {
        name:     addr.name,
        phone:    addr.phone,
        street:   addr.street,
        address:  addr.address,
        landmark: addr.landmark,
        city:     addr.city,
        state:    addr.state,
        pincode:  addr.pincode,
        type:     addr.type
      },
      items: orderItems,
      paymentMethod,
      paymentStatus: paymentMethod === "COD" ? "Pending" : "Paid",
      itemTotal,
      discount,
      tax,
      shippingCharge,
      finalTotal
    });
 
    
    await Cart.findOneAndUpdate({ userId }, { items: [], totalPrice: 0 });
 
    return res.redirect(`/order-success/${order._id}`);
  } catch (err) {
    console.error("placeOrder error:", err);
    return res.send(err.message);
  }
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