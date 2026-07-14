import Category from "../../models/categoryModel.js";
import cloudinary from "../../config/cloudinary.js";
import { renderAdmin } from "../../utils/renderAdmin.js";


const streamUpload = (buffer, folder = "categories") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    stream.end(buffer);
  });
};

/* ================= CATEGORY PAGE ================= */
const categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    let filter = { isDeleted: { $ne: true } };
    if (search && search.trim() !== "") {
      filter.name = { $regex: search.trim(), $options: "i" };
    }

    const totalCategories = await Category.countDocuments(filter);
    const cat = await Category.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(totalCategories / limit);

    res.status(200);
    renderAdmin(req, res, "category", { cat, currentPage: page, totalPages, search });
  } catch (error) {
    console.log(error);
    res.redirect("/admin/pagenotfound");
  }
};

/* ================= TOGGLE STATUS ================= */
const toggleCategoryStatus = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    category.isActive = !category.isActive;
    await category.save();

    res.status(200).json({ success: true });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false });
  }
};

/* ================= ADD CATEGORY ================= */
const addCategory = async (req, res) => {
  try {

 console.log("BODY:", req.body);
    console.log("FILE:", req.file);


    const name = req.body?.name;
    const description = req.body?.description;
    const isActive = req.body?.isActive;

    if (!name || !description || !req.file) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

const exists = await Category.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
      isDeleted: { $ne: true }
    });

    if (exists) {
      return res.status(409).json({ success: false, message: "Category already exists" });
    }

    const result = await streamUpload(req.file.buffer);

    await Category.create({
      name: name.trim(),
      description: description.trim(),
      image: result.secure_url,
      isActive: isActive === "true"
    });

    res.status(201).json({ success: true, message: "Category added successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

/* ================= DELETE CATEGORY ================= */
const deleteCategory = async (req, res) => {
  try {
    const updated = await Category.findByIdAndUpdate(req.params.id, { isDeleted: true });

    if (!updated) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false });
  }
};

/* ================= EDIT CATEGORY ================= */
const editCategory = async (req, res) => {
  try {
    const { name, description, isActive } = req.body;

      const duplicate = await Category.findOne({
      name: { $regex: `^${name.trim()}$`, $options: "i" },
      _id: { $ne: req.params.id }
    });

    if (duplicate) {
      return res.status(409).json({ success: false, message: "Category name already exists" });
    }

    const updateData = {
      name: name.trim(),
      description: description.trim(),
      isActive: isActive === "true"
    };

    if (req.file) {
      const result = await streamUpload(req.file.buffer);
      updateData.image = result.secure_url;
    }

    const updated = await Category.findByIdAndUpdate(req.params.id, updateData);

    if (!updated) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false });
  }
};

const addCategoryOffer = async (req, res) => {
  try {

    const { categoryId, offerPercentage } = req.body;

const pct = Number(offerPercentage);

    if (isNaN(pct) || pct < 0 || pct > 90) {
      return res.status(400).json({
        success: false,
        message: "Offer percentage must be between 0 and 90"
      });
    }

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    category.categoryOffer = pct;

    await category.save();

    res.status(200).json({
      success: true,
      message: "Category offer added"
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const removeCategoryOffer = async (req, res) => {
  try {

    const { categoryId } = req.body;

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    category.categoryOffer = 0;

    await category.save();

    res.status(200).json({
      success: true
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export {
  categoryInfo,
  toggleCategoryStatus,
  addCategory,
  deleteCategory,
  editCategory,
  addCategoryOffer,
  removeCategoryOffer
};