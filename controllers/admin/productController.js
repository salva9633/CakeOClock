const Product = require("../../models/productModel");
const Variant = require("../../models/variantModel");
const Category = require("../../models/categoryModel");
const cloudinary = require("../../config/cloudinary");
const Batch = require("../../models/batchModel"); // ✅ ADD THIS


/* =========================
   GET PRODUCTS LIST
========================= */

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("categoryId", "name") // ✅ get category name
      .lean();

    const categories = await Category.find({ isActive: true }).lean();

    res.render("products/products", {
      products,
      categories
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};


/* =========================
   ADD PRODUCT (CLOUDINARY)
========================= */
exports.addProduct = async (req, res) => {
  try {
    const { productName, description, longDescription, categoryId, brand } = req.body;

    if (!productName || !description || !categoryId) {
      return res.status(400).send("Missing required fields");
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).send("Product images are required");
    }

    const imageUrls = [];

    for (const file of req.files) {
      const result = await cloudinary.uploader.upload(
        `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
        { folder: "cake_oclock/products" }
      );

      imageUrls.push(result.secure_url);
    }

    // ✅ SAVE PRODUCT
    const product = await Product.create({
      productName,
      description,
      longDescription,
      categoryId,
      brand,                
      productImages: imageUrls
    });

    // ✅ REDIRECT TO VARIANT PAGE
    res.redirect(`/admin/products/${product._id}`);

  } catch (error) {
    console.error("ADD PRODUCT ERROR:", error);
    res.status(500).send("Add product failed");
  }
};


/* =========================
   PRODUCT DETAIL (VARIANTS)
========================= */
exports.getProductDetail = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId || productId === "add") {
      return res.redirect("/admin/products");
    }

    // 🔥 Auto-expire batches
    await Batch.markExpiredBatches();

    const product = await Product.findById(productId)
      .populate("categoryId", "name")
      .lean();

    if (!product) {
      return res.status(404).send("Product not found");
    }

    const variants = await Variant.find({ productId }).lean();

    // 🔥 Calculate stock per variant
    for (let variant of variants) {
      const batches = await Batch.find({
        variantId: variant._id,
        status: "active"
      });

      variant.totalStock = batches.reduce(
        (sum, b) => sum + b.availableStock,
        0
      );
    }

    res.render("products/productDetails", {
      product,
      variants
    });

  } catch (error) {
    console.error("PRODUCT DETAIL ERROR:", error);
    res.status(500).send("Product detail error");
  }
};
