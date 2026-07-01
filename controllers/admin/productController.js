import Product from "../../models/productModel.js";
import Variant from "../../models/variantModel.js";
import Category from "../../models/categoryModel.js";
import cloudinary from "../../config/cloudinary.js";
import Batch from "../../models/batchModel.js";

/* =========================
   GET PRODUCTS LIST
========================= */
export const getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    const filter = {};
    if (search) {
      filter.productName = { $regex: search, $options: "i" };
    }

    const totalProducts = await Product.countDocuments(filter);
   
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await Product.find(filter)
      .populate("categoryId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const categories = await Category.find({ isActive: true }).lean();

    res.render("products/products", {
      products,
      categories,
      currentPage: page,
      totalPages,
      search
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

/* =========================
   ADD PRODUCT
========================= */
export const addProduct = async (req, res) => {
  try {
const { productName, description, longDescription, categoryId, brand, discount, productOffer } = req.body;
    if (!productName || !description || !categoryId) {
      return res.status(400).json({ success: false, message: "Required fields missing" });
    }

    const cleanName = productName.trim();

    const existingProduct = await Product.findOne({
      productName: { $regex: `^${cleanName}$`, $options: "i" }
    });

    if (existingProduct) {
      return res.status(400).json({ success: false, message: "Product already exists" });
    }

    const imageUrls = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploadResult = await cloudinary.uploader.upload(
          `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
          { folder: "cake_oclock/products" }
        );
        imageUrls.push(uploadResult.secure_url);
      }
    }
const cleanProductOffer = Number(productOffer) || 0;
    if (cleanProductOffer > 90) {
      return res.status(400).json({ success: false, message: "Product offer cannot exceed 90%" });
    }

    const product = await Product.create({
      productName: cleanName,
      description,
      longDescription,
      categoryId,
      brand,
      discount,
      productOffer:  cleanProductOffer,
      productImages: imageUrls,
      isListed: true
    });

    return res.json({ success: true, redirectUrl: `/admin/products/${product._id}` });
  } catch (error) {
    console.error("ADD PRODUCT ERROR:", error);
    return res.status(500).json({ success: false, message: "Add product failed" });
  }
};

/* =========================
   EDIT PRODUCT
========================= */
export const editProduct = async (req, res) => {
  try {
    const { productId } = req.params;
const { productName, description, longDescription, categoryId, brand, productOffer } = req.body;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ success: false });
    }
const cleanName = productName.trim();

    const duplicate = await Product.findOne({
      productName: { $regex: `^${cleanName}$`, $options: "i" },
      _id: { $ne: productId }
    });

    if (duplicate) {
      return res.status(400).json({ success: false, message: "A product with this name already exists" });
    }
    product.productName = productName.trim();
    product.description = description;
    product.longDescription = longDescription;
    product.categoryId = categoryId;
    product.brand = brand;

const cleanProductOffer = Number(productOffer) || 0;
    if (cleanProductOffer > 90) {
      return res.status(400).json({ success: false, message: "Product offer cannot exceed 90%" });
    }
    product.productOffer    = cleanProductOffer;
    while (product.productImages.length < 5) {
      product.productImages.push("");
    }

    if (req.files && req.files.length > 0) {
      let indexes = req.body["imageIndexes[]"] || req.body.imageIndexes || [];
      if (!Array.isArray(indexes)) indexes = [indexes];

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
    return res.json({ success: true });
  } catch (err) {
    console.error("EDIT PRODUCT ERROR:", err);
    return res.status(500).json({ success: false });
  }
};

/* =========================
   PRODUCT DETAILS (ADMIN)
========================= */
export const getProductDetail = async (req, res) => {
  try {
    const { productId } = req.params;

    await Batch.markExpiredBatches();

    const product = await Product.findById(productId)
      .populate("categoryId", "name")
      .lean();

    if (!product) {
      return res.status(404).send("Product not found");
    }

    const variants = await Variant.find({ productId }).lean();

    for (let variant of variants) {
      const batches = await Batch.find({ variantId: variant._id, status: "active" });
      variant.totalStock = batches.reduce((sum, b) => sum + b.availableStock, 0);
    }

    res.render("products/productDetails", { product, variants });
  } catch (error) {
    console.error("PRODUCT DETAIL ERROR:", error);
    res.status(500).send("Product detail error");
  }
};

/* =========================
   TOGGLE PRODUCT LISTING
========================= */
export const toggleProductListing = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.json({ success: false });
    }

    product.isListed = !product.isListed;

    
    await product.save({ validateBeforeSave: false });

    res.json({ success: true, isListed: product.isListed });

  } catch (error) {
    console.error(error);
    res.json({ success: false });
  }
};