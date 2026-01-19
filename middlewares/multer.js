const multer = require("multer");

// ✅ Use memory storage (required for Cloudinary)
const storage = multer.memoryStorage();

// ✅ Allow only image files
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
        cb(null, true);
    } else {
        cb(new Error("Only image files are allowed"), false);
    }
};

// ✅ Multer config
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
    },
});

module.exports = upload;
