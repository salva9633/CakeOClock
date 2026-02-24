const Product = require("../../models/productModel");
const Variant = require("../../models/variantModel");
const Batch = require("../../models/batchModel");

/* ===============================
   LOAD PRODUCT DETAILS PAGE
================================ */
const loadProductDetailsPage = async (req, res) => {
  try {
    const productId = req.params.id;
    const selectedVariantId = req.query.variant;

    /* -------- Product -------- */
    const product = await Product.findById(productId).lean();
    if (!product || !product.isListed) {
      return res.status(404).render("404");
    }

    /* -------- Variants -------- */
    const variants = await Variant.find({
      productId,
      isAvailable: true
    })
      .sort({ salePrice: 1 }) // lowest first
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

    /* -------- Render -------- */
    res.render("productDetails", {
      product,
      variants,
      selectedVariant,
      relatedProducts
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
      availableStock: { $gt: 0 }
    }).lean();

    const totalStock = batches.reduce(
      (sum, b) => sum + b.availableStock,
      0
    );

    res.json({
      success: true,
      salePrice: variant.salePrice,
      regularPrice: variant.regularPrice,
      weight: variant.weight,
      stock: totalStock
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
};

module.exports = {
  loadProductDetailsPage,
  getVariantDetails
};
