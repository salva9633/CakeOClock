import Product  from "../../models/productModel.js";
import Variant  from "../../models/variantModel.js";
import Category from "../../models/categoryModel.js";
import Review   from "../../models/reviewModel.js";
import Offer    from "../../models/offerModel.js";
import { getOrderStatus } from "./orderController.js";

const loadProductsPage = async (req, res) => {
  try {
    const { search, category, brand, price, sort, page = 1 } = req.query;
 
    const limit = 8;
    const skip  = (page - 1) * limit;
 
    // ── 1. ACTIVE CATEGORIES ──────────────────────────────
    const activeCategories  = await Category.find({ isActive: true }).lean();
    const activeCategoryIds = activeCategories.map(c => c._id);
 
    // ── 2. PRODUCT FILTER ─────────────────────────────────
    const productFilter = {
      isListed:   true,
      categoryId: { $in: activeCategoryIds },
    };
 
    if (search) {
      productFilter.productName = { $regex: search, $options: "i" };
    }
 
    if (category) {
      const matched = activeCategoryIds.filter(id => id.toString() === category);
      if (matched.length) {
        productFilter.categoryId = { $in: matched };
      }
    }
 
    if (brand) {
      productFilter.brand = brand;
    }
 
    // ── 3. FETCH ALL MATCHING PRODUCTS ────────────────────
    const allProducts = await Product.find(productFilter)
      .populate("categoryId")
      .lean();
 
    // ── 4. PRICE FILTER ON VARIANTS ───────────────────────
    const priceFilter = { isAvailable: true };
 
   if (price) {
  const [min, max] = price.split("-").map(Number);
  priceFilter.regularPrice = { $gte: min, $lte: max };
}
 
    const productIds = allProducts.map(p => p._id);
 
    const allVariants = await Variant.find({
      productId: { $in: productIds },
      ...priceFilter
    })
      .sort({ regularPrice: 1 })
      .lean();
 
   const variantMap = {};
const allVariantIds = allVariants.map(v => v._id);

// Check stock for all variants in one query
const { default: Batch } = await import("../../models/batchModel.js");
const activeBatches = await Batch.find({
  variantId:      { $in: allVariantIds },
  status:         "active",
  expiryAt:       { $gt: new Date() },
  availableStock: { $gt: 0 }
}).lean();

const inStockVariantIds = new Set(
  activeBatches.map(b => b.variantId.toString())
);

for (const variant of allVariants) {
  const key = variant.productId.toString();
  if (!variantMap[key]) {
    // Prefer an in-stock variant; fall back to first if all OOS
    if (inStockVariantIds.has(variant._id.toString()) || !variantMap[key]) {
      variantMap[key] = variant;
    }
  }
}

// Track which products have ANY in-stock variant
const inStockProductIds = new Set();
for (const variant of allVariants) {
  if (inStockVariantIds.has(variant._id.toString())) {
    inStockProductIds.add(variant.productId.toString());
  }
}
    
 
    // ── 5. RATINGS — single aggregation, not N queries ────
    const ratingAgg = await Review.aggregate([
      { $match: { productId: { $in: productIds } } },
      {
        $group: {
          _id:          "$productId",
          avgRating:    { $avg: "$rating" },
          totalReviews: { $sum: 1 }
        }
      }
    ]);
 
    
    const ratingMap = {};
    for (const r of ratingAgg) {
      ratingMap[r._id.toString()] = {
        avgRating:    parseFloat(r.avgRating).toFixed(1),
        totalReviews: r.totalReviews
      };
    }
 
    // ── 6. BUILD PRODUCTS WITH PRICE + RATING ─────────────
   let productsWithPrice = (await Promise.all(allProducts
  .map(async product => {
    const variant = variantMap[product._id.toString()];
    if (!variant) return null;
 
  const { regularPrice } = variant;
const now = new Date();
const productOfferPct  = product.productOffer || 0;
const categoryOfferPct = product.categoryId?.categoryOffer || 0;
const bestDiscount     = Math.max(productOfferPct, categoryOfferPct);

const finalPrice = bestDiscount > 0
  ? Math.round(regularPrice - (regularPrice * bestDiscount / 100))
  : regularPrice;

const effectiveDiscount = bestDiscount;
const offerLabel = categoryOfferPct > productOfferPct ? "category" : "product";

        const { avgRating = "0.0", totalReviews = 0 } =
          ratingMap[product._id.toString()] || {};
 
// Check actual stock across batches
const { default: Batch } = await import("../../models/batchModel.js");
const batches = await Batch.find({
  variantId:      variant._id,
  status:         "active",
  expiryAt:       { $gt: new Date() },
  availableStock: { $gt: 0 }
}).lean();
const totalStock = batches.reduce((sum, b) => sum + b.availableStock, 0);

const hasStock = inStockProductIds.has(product._id.toString());

return {
  ...product,
  startingPrice: hasStock ? finalPrice : null,
  regularPrice,
  discount:      effectiveDiscount,
  offerLabel,
  avgRating,
  totalReviews
};
     })
)).filter(Boolean);
 
    // ── 7. SORTING ────────────────────────────────────────
    const sorters = {
      priceLowHigh: (a, b) => a.startingPrice - b.startingPrice,
      priceHighLow: (a, b) => b.startingPrice - a.startingPrice,
      az:           (a, b) => a.productName.localeCompare(b.productName),
      za:           (a, b) => b.productName.localeCompare(a.productName),
      newest:       (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    };
 
    if (sorters[sort]) {
      productsWithPrice.sort(sorters[sort]);
    } else {
      productsWithPrice.sort(sorters.newest);
    }
 
    // ── 8. PAGINATION ─────────────────────────────────────
    const totalProducts     = productsWithPrice.length;
    const totalPages        = Math.ceil(totalProducts / limit);
    const paginatedProducts = productsWithPrice.slice(skip, skip + limit);
 
    // ── 9. SIDEBAR DATA ───────────────────────────────────
    const brands = await Product.distinct("brand", { isListed: true });
 
    return res.render("products", {
      products:     paginatedProducts,
      categories:   activeCategories,
      brands,
      currentPage:  Number(page),
      totalPages,
      totalProducts,
      search:       search   || "",
      sort:         sort     || "",
      category:     category || "",
      price:        price    || "",
      brand:        brand    || "",
    });
 
  } catch (error) {
    console.error("loadProductsPage error:", error);
    return res.status(500).send("Server Error");
  }
};
 
export { loadProductsPage };