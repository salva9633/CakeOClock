import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";
import Variant from "../../models/variantModel.js";
import Wishlist from "../../models/wishlistModel.js";
import Batch from "../../models/batchModel.js";


/* ══════════════════════════════════════
   ADD TO CART
══════════════════════════════════════ */
export const addToCart = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, redirectUrl: "/login" });
    }
 
    const { productId, variantId, quantity = 1 } = req.body;
 
   if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID required" });
    }

    
    const product = await Product.findById(productId).lean();
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
        .sort({ salePrice: 1 })
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
        price:     variant.salePrice,
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
      success:   true,
      message:   "Added to cart",
      cartCount: cart.items.reduce((s, i) => s + i.quantity, 0),
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
        select: "productName description productImages isListed",
      })
      .populate({
        path:   "items.variantId",
        select: "salePrice regularPrice weight size isAvailable",
      })
      .lean();

    if (!cart || cart.items.length === 0) {
      return res.render("cart", { items: [], total: 0, hasOutOfStock: false });
    }

    
    const items = cart.items.filter(
      (item) => item.productId && item.productId.isListed !== false
    );

    
    for (const item of items) {
      const batches = await Batch.find({
        variantId: item.variantId._id || item.variantId,
        status: "active",
        availableStock: { $gt: 0 }
      }).lean();
      const totalStock = batches.reduce((s, b) => s + b.availableStock, 0);
      item.totalStock    = totalStock;
      item.outOfStock    = totalStock === 0;
      item.exceedsStock  = item.quantity > totalStock;
    }

    const hasOutOfStock = items.some(i => i.outOfStock || i.exceedsStock);
    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

    return res.render("cart", { items, total, hasOutOfStock });
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
        variantId: item.variantId,
        status: "active",
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

   const total = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);

const cartCount = cart.items.reduce(
  (sum, item) => sum + item.quantity,
  0
);

res.json({
  success: true,
  total,
  cartCount,
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
 const total = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);

const cartCount = cart.items.reduce(
  (sum, item) => sum + item.quantity,
  0
);

res.json({
  success: true,
  total,
  cartCount,
});

  } catch (err) {
    console.error("REMOVE CART ERROR:", err);
    res.status(500).json({ success: false });
  }
};
/* ══════════════════════════════════════
   GET VARIANTS BY PRODUCT
══════════════════════════════════════ */
export const getVariantsByProduct = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.json({ redirectUrl: "/login" });

    const variants = await Variant.find({
      productId: req.params.productId,
      isAvailable: true
    }).lean();

    res.json({ variants });
  } catch (err) {
    res.status(500).json({ variants: [] });
  }
};