import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";
import Variant from "../../models/variantModel.js";
import Wishlist from "../../models/wishlistModel.js";
import Batch from "../../models/batchModel.js";
import { getFinalPrice } from "../../utils/offerCalculator.js";
 
/* ══════════════════════════════════════
   ADD TO CART
══════════════════════════════════════ */
export const addToCart = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, redirectUrl: "/login" });
    }
 
    const { productId, variantId, quantity = 1, offerPrice } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID required" });
    }
 
    const product = await Product.findById(productId).select("productName isListed categoryId").lean();
    if (!product || !product.isListed) {
      return res.status(403).json({
        success: false,
        message: "This product is currently unavailable or has been removed.",
      });
    }
 
    let variant;
    if (variantId) {
      variant = await Variant.findById(variantId).lean();
    }
    if (!variant) {
      variant = await Variant.findOne({ productId, isAvailable: true })
        .sort({ regularPrice: 1 })
        .lean();
    }
 
    if (!variant) {
      return res.status(400).json({ success: false, message: "No available variant found" });
    }
 
    const batches = await Batch.find({
      variantId: variant._id,
      status: "active",
      availableStock: { $gt: 0 }
    }).lean();
    const totalStock = batches.reduce((s, b) => s + b.availableStock, 0);
 
    if (totalStock === 0) {
      return res.status(400).json({ success: false, message: "This item is out of stock" });
    }
 
    console.log("Adding to cart — userId:", userId, "productId:", productId, "variantId:", variant._id);
 
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }
 
    const existingIdx = cart.items.findIndex(
      (item) =>
        item.productId.toString() === productId.toString() &&
        item.variantId?.toString() === variant._id.toString()
    );
    const MAX_QTY = 5;
 
    // ── Offer price calculation (needed for both new & existing) ──
    const priceData = await getFinalPrice(variant);
    const effectivePrice = (offerPrice && offerPrice < priceData.finalPrice)
      ? offerPrice
      : priceData.finalPrice;
    // ──────────────────────────────────────────────────────────────
 
    if (existingIdx > -1) {
      const newQty = cart.items[existingIdx].quantity + Number(quantity);
 
      if (newQty > totalStock) {
        return res.status(400).json({ success: false, message: `Only ${totalStock} in stock` });
      }
      if (newQty > MAX_QTY) {
        return res.status(400).json({ success: false, message: `Maximum ${MAX_QTY} per item allowed` });
      }
 
      cart.items[existingIdx].quantity = newQty;
    } else {
      cart.items.push({
        productId: productId,
        variantId: variant._id,
        quantity:  Number(quantity),
        price:     effectivePrice,
      });
    }
 
    await cart.save();
 
    await Wishlist.updateOne(
      { userId },
      {
        $pull: {
          products: {
            productId,
            variantId: variant._id,
          },
        },
      }
    );
 
    console.log("Cart saved — total items:", cart.items.length);
 
    return res.json({
      success:         true,
      message:         "Added to cart",
      cartCount:       cart.items.reduce((s, i) => s + i.quantity, 0),
      // ── FIX 3: Return offer price data for popup display ──
      effectivePrice,
      regularPrice:    variant.regularPrice,
      discountPercent: priceData.discountPercent,
      hasDiscount:     variant.regularPrice > effectivePrice,
      // ─────────────────────────────────────────────────────
    });
  } catch (err) {
    console.error("ADD TO CART ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
 
/* ══════════════════════════════════════
   GET CART PAGE
══════════════════════════════════════ */
export const getCart = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/login");
 
    const cart = await Cart.findOne({ userId })
      .populate({
        path:   "items.productId",
        select: "productName description productImages isListed categoryId",
      })
      .populate({
        path:   "items.variantId",
        select: "salePrice regularPrice weight size isAvailable",
      })
      .lean();
 
    if (!cart || cart.items.length === 0) {
      return res.render("cart", { items: [], total: 0, savings: 0, hasOutOfStock: false });
    }
 
    const items = cart.items.filter((item) => item.productId);
 
    // Mark unlisted products as blocked
    for (const item of items) {
      if (!item.productId.isListed) {
        item.isBlocked = true;
        item.unavailableReason = "Product no longer available";
      }
    }
 
    for (const item of items) {
      const batches = await Batch.find({
        variantId:      item.variantId?._id || item.variantId,
        status:         "active",
        availableStock: { $gt: 0 }
      }).lean();
 
      const totalStock   = batches.reduce((s, b) => s + b.availableStock, 0);
      item.totalStock    = totalStock;
      item.outOfStock    = totalStock === 0;
      item.exceedsStock  = item.quantity > totalStock;
 
      item.variantUnavailable = item.variantId?.isAvailable === false;
 
      const priceData      = await getFinalPrice(item.variantId);
      item.effectivePrice  = (item.price < priceData.finalPrice) ? item.price : priceData.finalPrice;
      item.discountPercent = priceData.discountPercent;
      item.regularPrice    = item.variantId?.regularPrice || item.price;
 
      item.isBlocked = item.outOfStock || item.exceedsStock || item.variantUnavailable || !item.productId.isListed;
 
      if (!item.productId.isListed) {
        item.unavailableReason = "Product no longer available";
      } else if (item.variantUnavailable) {
        item.unavailableReason = "This option is no longer available";
      } else if (item.outOfStock) {
        item.unavailableReason = "Out of stock";
      } else if (item.exceedsStock) {
        item.unavailableReason = `Only ${item.totalStock} left in stock`;
      }
    }
 
    const validItems    = items.filter(i => !i.isBlocked);
    const hasOutOfStock = items.some(i => i.isBlocked);
    const total         = validItems.reduce((s, i) => s + i.effectivePrice * i.quantity, 0);
    const originalTotal = validItems.reduce((s, i) => s + i.regularPrice   * i.quantity, 0);
    const savings       = originalTotal - total;
 
    console.log("hasOutOfStock:", hasOutOfStock);
    console.log("blocked items:", items.filter(i => i.isBlocked).map(i => ({
      name: i.productId?.productName,
      outOfStock: i.outOfStock,
      totalStock: i.totalStock,
      exceedsStock: i.exceedsStock,
      variantUnavailable: i.variantUnavailable
    })));
 
    return res.render("cart", {
      items,
      total,
      savings,
      hasOutOfStock,
    });
  } catch (err) {
    console.error("GET CART ERROR:", err);
    res.status(500).send("Server Error");
  }
};
 
/* ══════════════════════════════════════
   UPDATE CART ITEM QTY
══════════════════════════════════════ */
export const updateCartItem = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.status(401).json({ success: false });
 
    const { itemId, quantity } = req.body;
    const MAX_QTY = 5;
 
    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });
 
    const item = cart.items.id(itemId);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });
 
    if (Number(quantity) <= 0) {
      item.deleteOne();
    } else {
      const batches = await Batch.find({
        variantId:      item.variantId,
        status:         "active",
        expiryAt:       { $gt: new Date() },
        availableStock: { $gt: 0 }
      }).lean();
      const totalStock = batches.reduce((s, b) => s + b.availableStock, 0);
 
      if (Number(quantity) > totalStock) {
        return res.status(400).json({
          success: false,
          message: `Only ${totalStock} in stock`
        });
      }
 
      if (Number(quantity) > MAX_QTY) {
        return res.status(400).json({
          success: false,
          message: `Maximum ${MAX_QTY} per item allowed`
        });
      }
 
      item.quantity = Number(quantity);
    }
 
    await cart.save();
 
    // ── FIX 1: Recalculate totals using effectivePrice (offer price) ──
    // We need to re-populate to get variant data for getFinalPrice
    const populatedCart = await Cart.findOne({ userId })
      .populate({
        path:   "items.productId",
        select: "isListed",
      })
      .populate({
        path:   "items.variantId",
        select: "salePrice regularPrice isAvailable",
      })
      .lean();
 
    let subtotal      = 0;
    let discountTotal = 0;
    let hasBlocked    = false;
 
    for (const i of populatedCart.items) {
      // Skip blocked/unlisted items from totals (same logic as getCart)
      const variantUnavailable = i.variantId?.isAvailable === false;
      const productUnlisted    = !i.productId?.isListed;
 
      const batches = await Batch.find({
        variantId:      i.variantId?._id || i.variantId,
        status:         "active",
        availableStock: { $gt: 0 }
      }).lean();
      const stock      = batches.reduce((s, b) => s + b.availableStock, 0);
      const outOfStock = stock === 0;
      const exceeds    = i.quantity > stock;
 
      const isBlocked = outOfStock || exceeds || variantUnavailable || productUnlisted;
      if (isBlocked) { hasBlocked = true; continue; }
 
      const priceData      = await getFinalPrice(i.variantId);
      const effectivePrice = (i.price < priceData.finalPrice) ? i.price : priceData.finalPrice;
      const regularPrice   = i.variantId?.regularPrice || i.price;
 
      subtotal      += regularPrice   * i.quantity;
      discountTotal += (regularPrice - effectivePrice) * i.quantity;
    }
 
    const total      = subtotal - discountTotal;
    const savings    = discountTotal;
    const cartCount  = populatedCart.items.reduce((s, i) => s + i.quantity, 0);
    // ──────────────────────────────────────────────────────────────────
 
    res.json({
      success:      true,
      total,
      subtotal,
      savings,
      cartCount,
      hasBlocked,   // FIX 2: tell frontend if checkout should be blocked
    });
 
  } catch (err) {
    console.error("UPDATE CART ERROR:", err);
    res.status(500).json({ success: false });
  }
};
 
/* ══════════════════════════════════════
   REMOVE CART ITEM
══════════════════════════════════════ */
export const removeCartItem = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.status(401).json({ success: false });
 
    const { itemId } = req.body;
 
    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });
 
    cart.items = cart.items.filter((i) => i._id.toString() !== itemId.toString());
    await cart.save();
 
    // ── FIX 1: Recalculate totals using effectivePrice ──
    const populatedCart = await Cart.findOne({ userId })
      .populate({
        path:   "items.productId",
        select: "isListed",
      })
      .populate({
        path:   "items.variantId",
        select: "salePrice regularPrice isAvailable",
      })
      .lean();
 
    let subtotal      = 0;
    let discountTotal = 0;
    let hasBlocked    = false;
 
    for (const i of (populatedCart?.items || [])) {
      const variantUnavailable = i.variantId?.isAvailable === false;
      const productUnlisted    = !i.productId?.isListed;
 
      const batches = await Batch.find({
        variantId:      i.variantId?._id || i.variantId,
        status:         "active",
        availableStock: { $gt: 0 }
      }).lean();
      const stock      = batches.reduce((s, b) => s + b.availableStock, 0);
      const outOfStock = stock === 0;
      const exceeds    = i.quantity > stock;
 
      const isBlocked = outOfStock || exceeds || variantUnavailable || productUnlisted;
      if (isBlocked) { hasBlocked = true; continue; }
 
      const priceData      = await getFinalPrice(i.variantId);
      const effectivePrice = (i.price < priceData.finalPrice) ? i.price : priceData.finalPrice;
      const regularPrice   = i.variantId?.regularPrice || i.price;
 
      subtotal      += regularPrice   * i.quantity;
      discountTotal += (regularPrice - effectivePrice) * i.quantity;
    }
 
    const total     = subtotal - discountTotal;
    const savings   = discountTotal;
    const cartCount = (populatedCart?.items || []).reduce((s, i) => s + i.quantity, 0);
    // ────────────────────────────────────────────────────
 
    res.json({
      success:   true,
      total,
      subtotal,
      savings,
      cartCount,
      hasBlocked,
    });
 
  } catch (err) {
    console.error("REMOVE CART ERROR:", err);
    res.status(500).json({ success: false });
  }
};
 
/* ══════════════════════════════════════
   VALIDATE CART BEFORE CHECKOUT
   GET /cart/validate
   Called by the checkout button click —
   checks stock, isListed, isAvailable
   without a page reload.
══════════════════════════════════════ */
export const validateCart = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.status(401).json({ success: false, redirectUrl: "/login" });
 
    const cart = await Cart.findOne({ userId })
      .populate({ path: "items.productId", select: "productName isListed" })
      .populate({ path: "items.variantId", select: "regularPrice isAvailable" })
      .lean();
 
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Your cart is empty." });
    }
 
    const blockedNames = [];
 
    for (const item of cart.items) {
      // Product deleted / unlisted
      if (!item.productId || !item.productId.isListed) {
        blockedNames.push(item.productId?.productName || "A product");
        continue;
      }
      // Variant unavailable
      if (!item.variantId || item.variantId.isAvailable === false) {
        blockedNames.push(item.productId.productName);
        continue;
      }
      // Stock check
      const batches = await Batch.find({
        variantId:      item.variantId._id || item.variantId,
        status:         "active",
        availableStock: { $gt: 0 }
      }).lean();
      const totalStock = batches.reduce((s, b) => s + b.availableStock, 0);
 
      if (totalStock === 0 || item.quantity > totalStock) {
        blockedNames.push(item.productId.productName);
      }
    }
 
    if (blockedNames.length > 0) {
      return res.json({
        success:  false,
        blocked:  true,
        message:  `Some items are unavailable: ${blockedNames.join(", ")}. Please remove them before checkout.`,
        names:    blockedNames,
      });
    }
 
    return res.json({ success: true });
  } catch (err) {
    console.error("VALIDATE CART ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
 
/* ══════════════════════════════════════
   GET VARIANTS BY PRODUCT
══════════════════════════════════════ */
export const getVariantsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const variants   = await Variant.find({ productId, isAvailable: true }).lean();
    const variantIds = variants.map(v => v._id);

    const activeBatches = await Batch.find({
      variantId:      { $in: variantIds },
      status:         "active",
      expiryAt:       { $gt: new Date() },
      availableStock: { $gt: 0 }
    }).lean();

    const stockMap = {};
    for (const batch of activeBatches) {
      const key = batch.variantId.toString();
      stockMap[key] = (stockMap[key] || 0) + batch.availableStock;
    }

    // ✅ Calculate offer price for each variant using getFinalPrice
    const variantsWithStock = await Promise.all(variants.map(async v => {
      const priceData = await getFinalPrice(v);
      return {
        ...v,
        stock:        stockMap[v._id.toString()] || 0,
        price:        priceData.finalPrice,          
        regularPrice: v.regularPrice,               
        discountPct:  priceData.discountPercent      
      };
    }));

    res.json({ success: true, variants: variantsWithStock });
  } catch (err) {
    console.error("getVariantsByProduct error:", err);
    res.status(500).json({ success: false, variants: [] });
  }
};
