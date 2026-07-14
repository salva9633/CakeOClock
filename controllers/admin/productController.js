import Product from "../../models/productModel.js";
import Variant from "../../models/variantModel.js";
import Category from "../../models/categoryModel.js";
import cloudinary from "../../config/cloudinary.js";
import Batch from "../../models/batchModel.js";
import { renderAdmin } from "../../utils/renderAdmin.js";

/* =========================
   SHARED VALIDATION
========================= */
function validateProductInput({ productName, description, longDescription, categoryId, brand, productOffer }) {
  const errors = [];

  const cleanName = (productName || "").trim();
  const cleanDesc = (description || "").trim();
  const cleanLongDesc = (longDescription || "").trim();
  const cleanBrand = (brand || "").trim();

  if (!cleanName) {
    errors.push("Product name is required");
  } else if (cleanName.length < 3 || cleanName.length > 100) {
    errors.push("Product name must be 3-100 characters");
  }

  if (!cleanDesc) {
    errors.push("Short description is required");
  } else if (cleanDesc.length < 10 || cleanDesc.length > 200) {
    errors.push("Short description must be 10-200 characters");
  }

  if (cleanLongDesc && cleanLongDesc.length > 3000) {
    errors.push("Long description must be under 3000 characters");
  }

  if (!categoryId) {
    errors.push("Category is required");
  }

  if (cleanBrand && cleanBrand.length > 50) {
    errors.push("Brand name must be under 50 characters");
  }

let cleanOffer = 0;
  if (productOffer !== undefined && productOffer !== null && productOffer !== "") {
    const parsedOffer = Number(productOffer);
    if (isNaN(parsedOffer)) {
      errors.push("Product offer must be a valid number");
    } else if (parsedOffer < 0 || parsedOffer > 90) {
      errors.push("Product offer must be between 0 and 90");
    } else {
      cleanOffer = parsedOffer;
    }
  }

  return {
    errors,
    clean: {
      cleanName,
      cleanDesc,
      cleanLongDesc,
      cleanBrand,
      cleanOffer
    }
  };
}

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

    renderAdmin(req, res, "products/products", {
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

    const { errors, clean } = validateProductInput({
      productName, description, longDescription, categoryId, brand, productOffer
    });

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors[0] });
    }

    // category must actually exist
    const categoryExists = await Category.findById(categoryId);
    if (!categoryExists) {
      return res.status(400).json({ success: false, message: "Invalid category selected" });
    }

    // require at least one image
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "At least one product image is required" });
    }
    if (req.files.length > 5) {
      return res.status(400).json({ success: false, message: "Maximum 5 images allowed" });
    }

    // duplicate name check
    const existingProduct = await Product.findOne({
      productName: { $regex: `^${clean.cleanName}$`, $options: "i" }
    });
    if (existingProduct) {
      return res.status(400).json({ success: false, message: "Product already exists" });
    }

    const imageUrls = [];
    for (const file of req.files) {
      const uploadResult = await cloudinary.uploader.upload(
        `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
        { folder: "cake_oclock/products" }
      );
      imageUrls.push(uploadResult.secure_url);
    }

    const product = await Product.create({
      productName: clean.cleanName,
      description: clean.cleanDesc,
      longDescription: clean.cleanLongDesc,
      categoryId,
      brand: clean.cleanBrand,
      discount,
      productOffer: clean.cleanOffer,
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
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const { errors, clean } = validateProductInput({
      productName, description, longDescription, categoryId, brand, productOffer
    });

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors[0] });
    }

    const categoryExists = await Category.findById(categoryId);
    if (!categoryExists) {
      return res.status(400).json({ success: false, message: "Invalid category selected" });
    }

    const duplicate = await Product.findOne({
      productName: { $regex: `^${clean.cleanName}$`, $options: "i" },
      _id: { $ne: productId }
    });
    if (duplicate) {
      return res.status(400).json({ success: false, message: "A product with this name already exists" });
    }

    product.productName = clean.cleanName;
    product.description = clean.cleanDesc;
    product.longDescription = clean.cleanLongDesc;
    product.categoryId = categoryId;
    product.brand = clean.cleanBrand;
    product.productOffer = clean.cleanOffer;

    while (product.productImages.length < 5) {
      product.productImages.push("");
    }

    if (req.files && req.files.length > 0) {
      if (req.files.length > 5) {
        return res.status(400).json({ success: false, message: "Maximum 5 images allowed" });
      }

      let indexes = req.body["imageIndexes[]"] || req.body.imageIndexes || [];
      if (!Array.isArray(indexes)) indexes = [indexes];

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const result = await cloudinary.uploader.upload(
          `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
          { folder: "cake_oclock/products" }
        );
        const index = parseInt(indexes[i]);
        if (!isNaN(index) && index >= 0 && index < 5) {
          product.productImages[index] = result.secure_url;
        }
      }
    }

    // ensure at least one image remains after edit
    const hasAnyImage = product.productImages.some(url => url && url.trim() !== "");
    if (!hasAnyImage) {
      return res.status(400).json({ success: false, message: "Product must have at least one image" });
    }

    await product.save();
    return res.json({ success: true });
  } catch (err) {
    console.error("EDIT PRODUCT ERROR:", err);
    return res.status(500).json({ success: false, message: "Update product failed" });
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

    renderAdmin(req, res, "products/productDetails", { product, variants });
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