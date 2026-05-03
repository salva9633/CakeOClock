import Product from "../../models/productModel.js";
import Variant from "../../models/variantModel.js";
import Batch from "../../models/batchModel.js";
import Review from "../../models/reviewModel.js";
/* ===============================
   LOAD PRODUCT DETAILS PAGE
================================ */
const loadProductDetailsPage = async (req, res) => {
  try {
    const productId = req.params.id;
    const selectedVariantId = req.query.variant;

    /* -------- Product -------- */
    const product = await Product.findOne({
      _id: productId,
      isListed: true
    }).lean();

    if (!product) {
      return res.status(404).render("404");
    }

    /* -------- Variants -------- */
    const variants = await Variant.find({
      productId,
      isAvailable: true
    })
      .sort({ salePrice: 1 }) 
      .lean();

    if (variants.length === 0) {
      return res.status(404).render("404");
    }

    /* -------- Selected Variant -------- */
    let selectedVariant;

    if (selectedVariantId) {
      selectedVariant = variants.find(
        v => v._id.toString() === selectedVariantId
      );
    }

    // fallback → cheapest variant
    if (!selectedVariant) {
      selectedVariant = variants[0];
    }

    /* -------- Initial Stock -------- */
const batches = await Batch.find({
  variantId: selectedVariant._id,
  status: "active",
  expiryAt: { $gt: new Date() },
  availableStock: { $gt: 0 }
}).lean();

const initialStock = batches.reduce((sum, b) => sum + b.availableStock, 0);

    /* -------- Related Products -------- */
    const relatedProductsRaw = await Product.find({
      categoryId: product.categoryId,
      _id: { $ne: product._id },
      isListed: true
    })
      .limit(4)
      .lean();

    const relatedProducts = await Promise.all(
      relatedProductsRaw.map(async (rp) => {
        const rpVariants = await Variant.find({
          productId: rp._id,
          isAvailable: true
        })
          .sort({ salePrice: 1 })
          .lean();

        return {
          ...rp,
          startingPrice: rpVariants.length ? rpVariants[0].salePrice : null
        };
      })
    );

    /* -------- Reviews -------- */
//  ALL REVIEWS (for count / future use)
const allReviews = await Review.find({ productId })
  .populate("userId", "name")
  .sort({ createdAt: -1 })
  .lean();

//  ONLY LAST 3 REVIEWS
const reviews = allReviews.slice(0, 3);

//  TOTAL COUNT
const totalReviews = allReviews.length;

const avgRating = totalReviews > 0
  ? (allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews).toFixed(1)
  : "0.0";

    /* -------- Render -------- */
res.render("productDetails", {
  product,
  variants,
  selectedVariant,
  relatedProducts,
  reviews,
  totalReviews,
  avgRating,
  initialStock 
  
  
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

    /* Stock from batches */
    const batches = await Batch.find({
      variantId,
      status: "active",
      expiryAt: { $gt: new Date() },   
      availableStock: { $gt: 0 }
    }).lean();

    const totalStock = batches.reduce(
      (sum, b) => sum + b.availableStock,
      0
    );

    const stockStatus = totalStock > 0 ? "In Stock" : "Out of Stock";
    
    res.json({
      success: true,
      salePrice: variant.salePrice,
      regularPrice: variant.regularPrice,
      weight: variant.weight,
      stock: totalStock,
      stockStatus
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
};

export {
  loadProductDetailsPage,
  getVariantDetails
};
