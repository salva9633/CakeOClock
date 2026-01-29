const Variant = require("../../models/variantModel");
const Batch = require("../../models/batchModel");
const Product = require("../../models/productModel");

/* =========================
   ADD VARIANT
========================= */
exports.addVariant = async (req, res) => {
  try {
    const { productId, weight, regularPrice, salePrice } = req.body;

    if (!productId || !weight || !regularPrice || !salePrice) {
      return res.status(400).send("All fields are required");
    }

    /* ---------- Product validation ---------- */
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).send("Product not found");
    }

    /* ---------- Weight validation ---------- */
    const allowedWeights = [500, 750, 1000, 2000];
    const parsedWeight = Number(weight);

    if (!allowedWeights.includes(parsedWeight)) {
      return res.status(400).send("Invalid weight selected");
    }

    /* ---------- Price validation ---------- */
    if (Number(salePrice) > Number(regularPrice)) {
      return res
        .status(400)
        .send("Sale price cannot be higher than regular price");
    }

    /* ---------- Create Variant ---------- */
    const variant = await Variant.create({
      productId,
      weight: parsedWeight,
      regularPrice: Number(regularPrice),
      salePrice: Number(salePrice)
    });

    /* ---------- Redirect to Batch Page ---------- */
    res.redirect(`/admin/variants/${variant._id}`);

  } catch (error) {
    console.error("ADD VARIANT ERROR:", error);

    if (error.code === 11000) {
      return res
        .status(400)
        .send("Variant with this weight already exists");
    }

    res.status(500).send("Add variant failed");
  }
};

/* =========================
   VARIANT DETAIL (BATCH LIST)
========================= */
exports.getVariantDetail = async (req, res) => {
  try {
    const { variantId } = req.params;

    // 🔥 Auto-expire batches
    await Batch.markExpiredBatches();

    const variant = await Variant.findById(variantId)
      .populate("productId", "productName")
      .lean();

    if (!variant) {
      return res.status(404).send("Variant not found");
    }

    const batches = await Batch.find({ variantId }).lean();

    res.render("products/variantDetails", {
      variant,
      batches
    });

  } catch (error) {
    console.error("VARIANT DETAIL ERROR:", error);
    res.status(500).send("Variant detail error");
  }
};
