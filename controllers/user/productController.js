import Product from "../../models/productModel.js";
import Variant from "../../models/variantModel.js";
import Category from "../../models/categoryModel.js";

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
      // ✅ Only filter to that category if it's actually active
      const matched = activeCategoryIds.filter(id => id.toString() === category);
      if (matched.length) {
        productFilter.categoryId = { $in: matched };
      }
    }

    if (brand) {
      productFilter.brand = brand;
    }

    // ── 3. FETCH ALL MATCHING PRODUCTS (no DB sort — JS will sort) ──
    const allProducts = await Product.find(productFilter)
      .populate("categoryId")
      .lean();

    // ── 4. PRICE FILTER ON VARIANTS (single query, not N queries) ──
    const priceFilter = { isAvailable: true };

    if (price) {
      const [min, max] = price.split("-").map(Number);
      priceFilter.salePrice = { $gte: min, $lte: max };
    }

    const productIds = allProducts.map(p => p._id);

    // ✅ ONE query for all variants instead of one per product
    const allVariants = await Variant.find({
      productId: { $in: productIds },
      ...priceFilter
    })
      .sort({ salePrice: 1 })
      .lean();

    // ✅ Group variants by productId for O(1) lookup
    const variantMap = {};
    for (const variant of allVariants) {
      const key = variant.productId.toString();
      if (!variantMap[key]) {
        variantMap[key] = variant; // first = cheapest (sorted above)
      }
    }

    // ── 5. BUILD PRODUCTS WITH PRICE ──────────────────────
    let productsWithPrice = allProducts
      .map(product => {
        const variant = variantMap[product._id.toString()];
        if (!variant) return null; // no available variant in price range

        const { salePrice, regularPrice } = variant;
        const discount = regularPrice > 0
          ? Math.round(((regularPrice - salePrice) / regularPrice) * 100)
          : 0;

        return {
          ...product,
          startingPrice: salePrice,
          regularPrice,
          discount
        };
      })
      .filter(Boolean);

    // ── 6. SORTING ────────────────────────────────────────
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
      // ✅ Default — newest first
      productsWithPrice.sort(sorters.newest);
    }

    // ── 7. PAGINATION (after sort) ────────────────────────
    const totalProducts     = productsWithPrice.length;
    const totalPages        = Math.ceil(totalProducts / limit);
    const paginatedProducts = productsWithPrice.slice(skip, skip + limit);

    // ── 8. SIDEBAR DATA ───────────────────────────────────
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