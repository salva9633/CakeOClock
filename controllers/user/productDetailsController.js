import Product from "../../models/productModel.js";
import Variant  from "../../models/variantModel.js";
import Batch    from "../../models/batchModel.js";
import Review   from "../../models/reviewModel.js";
import Order    from "../../models/orderModel.js";

/* ===============================
   LOAD PRODUCT DETAILS PAGE
================================ */
const loadProductDetailsPage = async (req, res) => {
  try {
    const productId         = req.params.id;
    const selectedVariantId = req.query.variant;
 
    const userId = req.session?.user?.id || req.session?.user?._id || null;
 
    /* -------- Product -------- */
    const product = await Product.findOne({ _id: productId, isListed: true })
    .populate("categoryId")   
    .lean();
    if (!product) return res.status(404).render("404");
 
    /* -------- Variants -------- */
    const variants = await Variant.find({ productId, isAvailable: true })
      .sort({ salePrice: 1 })
      .lean();
    if (variants.length === 0) return res.status(404).render("404");
 
    /* -------- Selected Variant -------- */
    let selectedVariant;
    if (selectedVariantId) {
      selectedVariant = variants.find(v => v._id.toString() === selectedVariantId);
    }
    if (!selectedVariant) selectedVariant = variants[0];
 
    /* -------- Initial Stock -------- */
    const batches = await Batch.find({
      variantId:      selectedVariant._id,
      status:         "active",
      expiryAt:       { $gt: new Date() },
      availableStock: { $gt: 0 }
    }).lean();
    const initialStock = batches.reduce((sum, b) => sum + b.availableStock, 0);
 
    /* -------- Related Products (with ratings) -------- */
    const relatedProductsRaw = await Product.find({
      categoryId: product.categoryId,
      _id:        { $ne: product._id },
      isListed:   true
    })
      .limit(4)
      .lean();
 
    const relatedProductIds = relatedProductsRaw.map(p => p._id);
 
    const relatedRatingAgg = await Review.aggregate([
      { $match: { productId: { $in: relatedProductIds } } },
      {
        $group: {
          _id:          "$productId",
          avgRating:    { $avg: "$rating" },
          totalReviews: { $sum: 1 }
        }
      }
    ]);
    const relatedRatingMap = {};
    for (const r of relatedRatingAgg) {
      relatedRatingMap[r._id.toString()] = {
        avgRating:    parseFloat(r.avgRating).toFixed(1),
        totalReviews: r.totalReviews
      };
    }
 
    const relatedProducts = await Promise.all(
      relatedProductsRaw.map(async (rp) => {
        const rpVariants = await Variant.find({ productId: rp._id, isAvailable: true })
          .sort({ salePrice: 1 })
          .lean();
        const { avgRating = "0.0", totalReviews = 0 } =
          relatedRatingMap[rp._id.toString()] || {};
        return {
          ...rp,
          startingPrice: rpVariants.length ? rpVariants[0].salePrice : null,
          avgRating,
          totalReviews
        };
      })
    );
 
    /* -------- Reviews -------- */
    const allReviews = await Review.find({ productId })
      .populate("userId", "name")
      .sort({ createdAt: -1 })
      .lean();
 
    const reviews      = allReviews.slice(0, 3);
    const totalReviews = allReviews.length;
 
    /* -------- Average Rating -------- */
    const avgRating =
      totalReviews > 0
        ? (allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews).toFixed(1)
        : "0.0";
 
    let canReview = false;
 
    if (userId) {
      const deliveredOrder = await Order.findOne({
        userId,
        items: {
          $elemMatch: {
            productId: productId,
            status:    "Delivered"
          }
        }
      }).lean();
      canReview = !!deliveredOrder;
    }
 
/* -------- Offer Calculation -------- */
const productOffer  = product.productOffer  || 0;
const categoryOffer = product.categoryId?.categoryOffer || 0;
const bestOffer     = Math.max(productOffer, categoryOffer);
const finalPrice    = selectedVariant.salePrice - (selectedVariant.salePrice * bestOffer / 100);

const offerData = {
  productOffer,
  categoryOffer,
  bestOffer,
  finalPrice,
  activeOfferLabel: bestOffer === 0 ? null
                  : categoryOffer > productOffer ? "category"
                  : "product"
};
/* -------- Render -------- */
res.render("productDetails", {
  product,
  variants,
  selectedVariant,
  relatedProducts,
  reviews,
  totalReviews,
  avgRating,
  initialStock,
  canReview,
  isLoggedIn: !!userId,
  offerData
});
 
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};
 
/* ===============================
   AJAX – VARIANT PRICE UPDATE
================================ */
const getVariantDetails = async (req, res) => {
  try {
    const { variantId } = req.params;
 
    const variant = await Variant.findById(variantId).lean();
    if (!variant || !variant.isAvailable) {
      return res.status(404).json({ success: false });
    }
 
    const batches = await Batch.find({
      variantId,
      status:         "active",
      expiryAt:       { $gt: new Date() },
      availableStock: { $gt: 0 }
    }).lean();
 
    const totalStock = batches.reduce((sum, b) => sum + b.availableStock, 0);
 
    res.json({
      success:      true,
      salePrice:    variant.salePrice,
      regularPrice: variant.regularPrice,
      weight:       variant.weight,
      stock:        totalStock,
      stockStatus:  totalStock > 0 ? "In Stock" : "Out of Stock"
    });
 
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
};
 
export { loadProductDetailsPage, getVariantDetails };