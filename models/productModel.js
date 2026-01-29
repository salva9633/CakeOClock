const mongoose = require("mongoose"); // ✅ MISSING LINE

const productSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      required: true
    },

    longDescription: {
      type: String
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },

    brand: {
      type: String,
      trim: true
    },

    productImages: {
      type: [String],
      required: true
    },

    isListed: {
      type: Boolean,
      default: true
    },

    averageRating: {
      type: Number,
      default: 0
    },

    reviewCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
