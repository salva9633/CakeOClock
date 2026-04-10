const Product = require("../../models/productModel");
const Variant = require("../../models/variantModel");
const Category = require("../../models/categoryModel");

const loadProductsPage = async (req, res) => {
  try {
    const { search, category, brand, price, sort, page = 1 } = req.query;

    const limit = 8;
    const skip = (page - 1) * limit;

    const activeCategories = await Category.find({ isActive: true }).lean();
    const activeCategoryIds = activeCategories.map(c => c._id);

    
  let productFilter = {
  isListed: true,
  categoryId: { $in: activeCategoryIds }
};

if (search) {
  productFilter.productName = { $regex: search, $options: "i" };
}

if (category) {
  productFilter.categoryId = {
    $in: activeCategoryIds.filter(id => id.toString() === category)
  };
}

if (brand) {
  productFilter.brand = brand;
}

const allProducts = await Product.find({ ...productFilter, isListed: true })
  .populate("categoryId")
  .lean();
    /* ================= PRICE FILTER (VARIANT) ================= */
   let priceFilter = {};

if (price) {
  const [min, max] = price.split("-");
  priceFilter.salePrice = { $gte: Number(min), $lte: Number(max) };
}

let productsWithPrice = await Promise.all(
  allProducts.map(async (product) => {

    // ✅ FIX: double safety check
    if (!product.isListed) return null;

    const variants = await Variant.find({
      productId: product._id,
      isAvailable: true,
      ...priceFilter
    })
      .sort({ salePrice: 1 })
      .lean();

    if (!variants.length) return null;

    const salePrice = variants[0].salePrice;
    const regularPrice = variants[0].regularPrice;

    const discount = Math.round(
      ((regularPrice - salePrice) / regularPrice) * 100
    );

    return {
      ...product,
      startingPrice: salePrice,
      regularPrice: regularPrice,
      discount: discount
    };
  })
);
    // ✅ Filter nulls only - isListed already handled in DB query
    productsWithPrice = productsWithPrice.filter(Boolean);

    /* ================= SORTING ================= */
    if (sort === "priceLowHigh") {
      productsWithPrice.sort((a, b) => a.startingPrice - b.startingPrice);
    }
    if (sort === "priceHighLow") {
      productsWithPrice.sort((a, b) => b.startingPrice - a.startingPrice);
    }
    if (sort === "az") {
      productsWithPrice.sort((a, b) => a.productName.localeCompare(b.productName));
    }
    if (sort === "za") {
      productsWithPrice.sort((a, b) => b.productName.localeCompare(a.productName));
    }

    /* ================= PAGINATION ================= */
    const totalProducts = productsWithPrice.length;
    const totalPages = Math.ceil(totalProducts / limit);
    const paginatedProducts = productsWithPrice.slice(skip, skip + limit);

    /* ================= SIDEBAR DATA ================= */
    // ✅ Only show active categories in sidebar
    const brands = await Product.distinct("brand", { isListed: true });
res.render("products", {
  products: paginatedProducts,
  categories: activeCategories,
  brands,
  currentPage: Number(page),
  totalPages,
  search:   search   || "",
  sort:     sort     || "",
  category: category || "",
  price:    price    || "",
  brand:    brand    || ""
});

  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

module.exports = { loadProductsPage };