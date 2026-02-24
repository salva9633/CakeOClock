const Product = require("../../models/productModel");
const Variant = require("../../models/variantModel");
const Category = require("../../models/categoryModel");

const loadProductsPage = async (req, res) => {
  try {
    const {
      search,
      category,
      brand,
      price,
      sort,
      page = 1
    } = req.query;

    const limit = 8; // products per page
    const skip = (page - 1) * limit;

    /* ================= PRODUCT FILTER ================= */
    let productFilter = {
      isListed: true // ✅ hide blocked/unlisted
    };

    // Search (name)
    if (search) {
      productFilter.productName = {
        $regex: search,
        $options: "i"
      };
    }

    if (category) {
      productFilter.categoryId = category;
    }

    if (brand) {
      productFilter.brand = brand;
    }

    const allProducts = await Product.find(productFilter).lean();

    /* ================= PRICE FILTER (VARIANT) ================= */
    let minPrice = 0;
    let maxPrice = Infinity;

    if (price) {
      const [min, max] = price.split("-");
      minPrice = Number(min);
      maxPrice = Number(max);
    }

    let productsWithPrice = await Promise.all(
      allProducts.map(async (product) => {
        const variants = await Variant.find({
          productId: product._id,
          isAvailable: true,
          salePrice: { $gte: minPrice, $lte: maxPrice }
        })
          .sort({ salePrice: 1 })
          .lean();

        if (!variants.length) return null;

        return {
          ...product,
          startingPrice: variants[0].salePrice,
          regularPrice: variants[0].regularPrice
        };
      })
    );

    productsWithPrice = productsWithPrice.filter(Boolean);

    /* ================= SORTING ================= */
    if (sort === "priceLowHigh") {
      productsWithPrice.sort((a, b) => a.startingPrice - b.startingPrice);
    }

    if (sort === "priceHighLow") {
      productsWithPrice.sort((a, b) => b.startingPrice - a.startingPrice);
    }

    if (sort === "az") {
      productsWithPrice.sort((a, b) =>
        a.productName.localeCompare(b.productName)
      );
    }

    if (sort === "za") {
      productsWithPrice.sort((a, b) =>
        b.productName.localeCompare(a.productName)
      );
    }

    /* ================= PAGINATION ================= */
    const totalProducts = productsWithPrice.length;
    const totalPages = Math.ceil(totalProducts / limit);

    const paginatedProducts = productsWithPrice.slice(skip, skip + limit);

    /* ================= SIDEBAR DATA ================= */
    const categories = await Category.find().lean();
    const brands = await Product.distinct("brand");

    res.render("products", {
      products: paginatedProducts,
      categories,
      brands,
      currentPage: Number(page),
      totalPages,
      search,
      sort
    });

  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

module.exports = { loadProductsPage };
