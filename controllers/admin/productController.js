const Product = require("../../models/productModel");
const Variant = require("../../models/variantModel");
const Category = require("../../models/categoryModel");
const cloudinary = require("../../config/cloudinary");
const Batch = require("../../models/batchModel");

/* =========================
   GET PRODUCTS LIST
========================= */
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("categoryId", "name")
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
   ADD PRODUCT
========================= */
exports.addProduct = async (req, res) => {
  try {
    const { productName, description, longDescription, categoryId, brand } = req.body;

    const cleanName = productName.trim();

    const existingProduct = await Product.findOne({
      productName: { $regex: new RegExp("^" + cleanName + "$", "i") }
    });

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: "Product already exists"
      });
    }

    const imageUrls = [];

    for (const file of req.files) {
      const result = await cloudinary.uploader.upload(
        `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
        { folder: "cake_oclock/products" }
      );
      imageUrls.push(result.secure_url);
    }

    const product = await Product.create({
      productName: cleanName,
      description,
      longDescription,
      categoryId,
      brand,
      productImages: imageUrls
    });

    res.json({
      success: true,
      redirectUrl: `/admin/products/${product._id}`
    });

  } catch (error) {
    console.error("ADD PRODUCT ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Add product failed"
    });
  }
};

/* =========================
   EDIT PRODUCT (WITH IMAGE UPDATE)
========================= */
exports.editProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { productName, description, longDescription, categoryId, brand } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false });
    }

    // Update text fields
    product.productName = productName.trim();
    product.description = description;
    product.longDescription = longDescription;
    product.categoryId = categoryId;
    product.brand = brand;

    // Ensure 5 slots
    while (product.productImages.length < 5) {
      product.productImages.push(null);
    }

    // Update images
    if (req.files && req.files.length > 0) {

      let indexes = req.body["imageIndexes[]"] || [];

      if (!Array.isArray(indexes)) {
        indexes = [indexes];
      }

      for (let i = 0; i < req.files.length; i++) {

        const file = req.files[i];

        const result = await cloudinary.uploader.upload(
          `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
          { folder: "cake_oclock/products" }
        );

        const index = parseInt(indexes[i]);

        if (!isNaN(index)) {
          product.productImages[index] = result.secure_url;
        }
      }
    }

    await product.save();

    res.json({ success: true });

  } catch (err) {
    console.error("EDIT PRODUCT ERROR:", err);
    res.status(500).json({ success: false });
  }
};
/* =========================
   PRODUCT DETAILS
========================= */
exports.getProductDetail = async (req, res) => {
  try {
    const { productId } = req.params;

    await Batch.markExpiredBatches();

    const product = await Product.findById(productId)
      .populate("categoryId", "name")
      .lean();

    const variants = await Variant.find({ productId }).lean();

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

/* =========================
   TOGGLE LISTING
========================= */
exports.toggleProductListing = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId);

    product.isListed = !product.isListed;
    await product.save();

    res.json({ success: true });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update product visibility"
    });
  }
};