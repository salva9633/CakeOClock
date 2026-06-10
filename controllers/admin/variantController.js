import Variant from "../../models/variantModel.js";
import Batch from "../../models/batchModel.js";
import Product from "../../models/productModel.js";

/* =========================
   ADD VARIANT
========================= */
export const addVariant = async (req, res) => {
  try {
const { productId, weight, costPrice, regularPrice } = req.body;

 if (!productId || !weight || !costPrice || !regularPric) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const product = await Product.findById(productId);
    if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });

  }

    const allowedWeights = [60, 80, 500, 750, 1000, 2000, 3000];
    const parsedWeight = Number(weight);

    if (!allowedWeights.includes(parsedWeight)) {
    return res.status(400).json({ success: false, message: "Invalid weight selected" });
    }

    if (Number(salePrice) < Number(costPrice)) {
  return res.status(400).json({ success: false, message: "Sale price cannot be lower than cost price" });
}

    if (Number(salePrice) < Number(costPrice)) {
    return res.status(400).json({ success: false, message: "Sale price cannot be lower than cost price" });
    }

    const variant = await Variant.create({
      productId,
      weight: parsedWeight,
      costPrice: Number(costPrice),
      regularPrice: Number(regularPrice),
    });

res.status(200).json({ success: true, variantId: variant._id });
  } catch (error) {
    console.error("ADD VARIANT ERROR:", error);

if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "A variant with this weight already exists for this product." });
    }

    res.status(500).json({ success: false, message: "Add variant failed" });
  }
};

/* =========================
   VARIANT DETAIL (BATCH LIST)
========================= */
export const getVariantDetail = async (req, res) => {
  try {
    const { variantId } = req.params;

    await Batch.markExpiredBatches();

    const variant = await Variant.findById(variantId)
      .populate("productId", "productName")
      .lean();

    if (!variant) {
      return res.status(404).send("Variant not found");
    }

    const batches = await Batch.find({ variantId }).lean();

    res.render("products/variantDetails", { variant, batches });
  } catch (error) {
    console.error("VARIANT DETAIL ERROR:", error);
    res.status(500).send("Variant detail error");
  }
};

/* =========================
   UPDATE VARIANT
========================= */
export const updateVariant = async (req, res) => {
  try {
    const { variantId } = req.params;
  const { weight, costPrice, regularPrice } = req.body;

const variant = await Variant.findByIdAndUpdate(
  variantId,
  { weight, costPrice, regularPrice },
      { new: true }
    );

    res.redirect(`/admin/products/${variant.productId}`);
  } catch (error) {
    console.error("UPDATE VARIANT ERROR:", error);
    res.status(500).send("Update failed");
  }
};
