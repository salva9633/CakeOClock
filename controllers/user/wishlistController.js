import Wishlist from "../../models/wishlistModel.js";
import Product from "../../models/productModel.js";
import Variant from "../../models/variantModel.js";

/* ══════════════════════════════════════
   CLEAN INVALID WISHLIST ITEMS
══════════════════════════════════════ */
const cleanWishlist = async (wishlist) => {
  if (!wishlist || !wishlist.products?.length) return wishlist;

  const cleanedProducts = [];

  for (const item of wishlist.products) {

    if (!item.productId || !item.variantId) continue;

    
    const product = await Product.findOne({
      _id: item.productId,
      isListed: true,
    }).lean();

    if (!product) continue;

    
    let variant = await Variant.findOne({
      _id: item.variantId,
      isAvailable: true,
    }).lean();

    
    if (!variant) {
      variant = await Variant.findOne({
        productId: item.productId,
        isAvailable: true,
      })
        .sort({ salePrice: 1 })
        .lean();
    }

    if (!variant) continue;

    cleanedProducts.push({
      productId: item.productId,
      variantId: variant._id,
    });
  }

  wishlist.products = cleanedProducts;

  await wishlist.save();

  return wishlist;
};

/* ══════════════════════════════════════
   TOGGLE WISHLIST
══════════════════════════════════════ */
export const toggleWishlist = async (req, res) => {
  try {
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login",
        redirectUrl: "/login",
      });
    }

    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID required",
      });
    }

  
    const product = await Product.findById(productId).lean();

    if (!product || !product.isListed) {
      return res.status(403).json({
        success: false,
        message: "This product is unavailable",
      });
    }

    
    const variant = await Variant.findOne({
      productId,
      isAvailable: true,
    })
      .sort({ salePrice: 1 })
      .lean();

    if (!variant) {
      return res.status(403).json({
        success: false,
        message: "No variants available",
      });
    }

    const variantId = variant._id;

    
    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({
        userId,
        products: [],
      });
    }

    
    wishlist = await cleanWishlist(wishlist);

    
    const existingIndex = wishlist.products.findIndex(
      (item) =>
        item.productId &&
        item.productId.toString() === productId.toString()
    );

    if (existingIndex === -1) {
      
      wishlist.products.push({
        productId,
        variantId,
      });

      await wishlist.save();

      return res.json({
        success: true,
        wished: true,
        message: "Added to wishlist",
        wishlistCount: wishlist.products.length,
      });
    } else {
    
      wishlist.products.splice(existingIndex, 1);

      await wishlist.save();

      return res.json({
        success: true,
        wished: false,
        message: "add cake to wishlist",
        wishlistCount: wishlist.products.length,
      });
    }
  } catch (err) {
    console.error("WISHLIST TOGGLE ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/* ══════════════════════════════════════
   GET WISHLIST PAGE
══════════════════════════════════════ */
export const getWishlist = async (req, res) => {
  try {
    const userId = req.session.user?.id;

    if (!userId) {
      return res.redirect("/login");
    }

    
    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      return res.render("wishlist", {
        products: [],
      });
    }

    
    wishlist = await cleanWishlist(wishlist);

    
    if (!wishlist.products.length) {
      return res.render("wishlist", {
        products: [],
      });
    }

    const productIds = wishlist.products.map(
      (item) => item.productId
    );

    const rawProducts = await Product.find({
      _id: { $in: productIds },
      isListed: true,
    }).lean();

    const products = await Promise.all(
      rawProducts.map(async (product) => {
        const wishItem = wishlist.products.find(
          (item) =>
            item.productId.toString() === product._id.toString()
        );

        let variant = await Variant.findOne({
          _id: wishItem.variantId,
          isAvailable: true,
        }).lean();

        
        if (!variant) {
          variant = await Variant.findOne({
            productId: product._id,
            isAvailable: true,
          })
            .sort({ salePrice: 1 })
            .lean();
        }

        return {
          ...product,

          variantId: variant?._id || null,

          startingPrice: variant?.salePrice || null,

          regularPrice: variant?.regularPrice || null,

          isBlocked: !product.isListed,

          discount: variant
            ? Math.round(
                ((variant.regularPrice - variant.salePrice) /
                  variant.regularPrice) *
                  100
              )
            : 0,
        };
      })
    );

    return res.render("wishlist", {
      products,
    });
  } catch (err) {
    console.error("GET WISHLIST ERROR:", err);

    return res.status(500).send("Server Error");
  }
};