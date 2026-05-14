import Wishlist from "../../models/wishlistModel.js";
import Product  from "../../models/productModel.js";
import Variant  from "../../models/variantModel.js";

/* ══════════════════════════════════════
   TOGGLE  –  Add / Remove from wishlist
══════════════════════════════════════ */
export const toggleWishlist = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({
        success:     false,
        message:     "Please login",
        redirectUrl: "/login",
      });
    }

    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID required" });
    }

    // ✅ Check product exists and is listed
    const product = await Product.findById(productId).lean();
    if (!product || !product.isListed) {
      return res.status(403).json({
        success: false,
        message: "This product is currently unavailable or has been removed.",
      });
    }

    // ✅ Auto-pick cheapest available variant (no variantId needed from frontend)
    const variant = await Variant.findOne({
      productId,
      isAvailable: true,
    }).sort({ salePrice: 1 }).lean();

    if (!variant) {
      return res.status(403).json({
        success: false,
        message: "No variants available for this product.",
      });
    }

    const variantId = variant._id;

    let wishlist = await Wishlist.findOne({ userId });

    // ── No wishlist yet → create with this product ──
    if (!wishlist) {
      wishlist = new Wishlist({
        userId,
        products: [{ productId, variantId }],
      });
      await wishlist.save();
      return res.json({
        success:       true,
        wished:        true,
        message:       "Added to wishlist",
        wishlistCount: wishlist.products.length,
      });
    }


// ── Clean corrupt entries first ──
    wishlist.products = wishlist.products.filter(
      (item) => item.productId && item.variantId
    );

    // ── Check if product already in wishlist (by productId only) ──
    const existingIndex = wishlist.products.findIndex(
      (item) => item.productId && item.productId.toString() === productId.toString()
    );
    if (existingIndex === -1) {
      // ── Add ──
      wishlist.products.push({ productId, variantId });
      await wishlist.save();
      return res.json({
        success:       true,
        wished:        true,
        message:       "Added to wishlist",
        wishlistCount: wishlist.products.length,
      });
    } else {
      // ── Remove ──
      wishlist.products.splice(existingIndex, 1);
      await wishlist.save();
      return res.json({
        success:       true,
        wished:        false,
        message:       "Removed from wishlist",
        wishlistCount: wishlist.products.length,
      });
    }

  } catch (err) {
    console.error("WISHLIST TOGGLE ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ══════════════════════════════════════
   GET WISHLIST PAGE
══════════════════════════════════════ */
export const getWishlist = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/login");

    const wishlist = await Wishlist.findOne({ userId }).lean();

    if (!wishlist || wishlist.products.length === 0) {
      return res.render("wishlist", { products: [] });
    }

    const productIds = wishlist.products.map((item) => item.productId);

    const rawProducts = await Product.find({
      _id:      { $in: productIds },
      isListed: true,
    }).lean();

    const products = await Promise.all(
      rawProducts.map(async (product) => {
        const wishItem = wishlist.products.find(
          (item) => item.productId.toString() === product._id.toString()
        );

        // ✅ Try saved variantId first, fallback to cheapest available
        let variant = await Variant.findOne({
          _id:         wishItem.variantId,
          isAvailable: true,
        }).lean();

        if (!variant) {
          variant = await Variant.findOne({
            productId:   product._id,
            isAvailable: true,
          }).sort({ salePrice: 1 }).lean();
        }

return {
          ...product,
          variantId:     variant?._id    || null,
          startingPrice: variant?.salePrice    || null,
          regularPrice:  variant?.regularPrice || null,
          isBlocked:     !product.isListed,   // ← ADD THIS LINE
          discount: variant
            ? Math.round(
                ((variant.regularPrice - variant.salePrice) / variant.regularPrice) * 100
              )
            : 0,
        };
            })
    );

    return res.render("wishlist", { products });

  } catch (err) {
    console.error("GET WISHLIST ERROR:", err);
    res.status(500).send("Server Error");
  }
};