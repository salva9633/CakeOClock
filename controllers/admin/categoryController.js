const Category = require("../../models/categoryModel");
const cloudinary = require("../../config/cloudinary");


/* ================= CATEGORY PAGE ================= */
const categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const cat = await Category.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments();
    const totalPages = Math.ceil(totalCategories / limit);

    res.render("category", {
      cat,
      currentPage: page,
      totalPages
    });

  } catch (error) {
    console.log(error);
    res.redirect("/admin/pagenotfound");
  }
};


/* ================= TOGGLE STATUS ================= */
const toggleCategoryStatus = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    category.isActive = !category.isActive;
    await category.save();

    res.json({ success: true });
  } catch (error) {
    console.log(error);
    res.json({ success: false });
  }
};


/* ================= ADD CATEGORY ================= */

const addCategory = async (req, res) => {
  try {
    console.log("REQ BODY:", req.body);
    console.log("REQ FILE:", req.file);

    const name = req.body?.name;
    const description = req.body?.description;
    const isActive = req.body?.isActive;

    if (!name || !description || !req.file) {
      return res.json({
        success: false,
        message: "All fields are required"
      });
    }

    const exists = await Category.findOne({
      name: { $regex: `^${name}$`, $options: "i" }
    });

    if (exists) {
      return res.json({
        success: false,
        message: "Category already exists"
      });
    }

  const streamUpload = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "categories" },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    stream.end(buffer);
  });
};

const result = await streamUpload(req.file.buffer);


    await Category.create({
      name: name.trim(),
      description: description.trim(),
      image: result.secure_url,
      isActive: isActive === "true"
    });

    res.json({
      success: true,
      message: "Category added successfully"
    });

  } catch (error) {
    console.log(error);
    res.json({
      success: false,
      message: "Something went wrong"
    });
  }
};









module.exports = {
  categoryInfo,
  toggleCategoryStatus,
  addCategory
  

};
