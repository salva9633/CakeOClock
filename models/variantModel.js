const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },

    weight: {
      type: Number, // grams
      required: true
    },

    regularPrice: {
      type: Number,
      required: true
    },

    salePrice: {
      type: Number,
      required: true
    },

    isAvailable: {
      type: Boolean,
      default: true
    },

    imageUrls: {
      type: [String]
    }
  },
  { timestamps: true }
);

/* Prevent duplicate weights for same product */
variantSchema.index({ productId: 1, weight: 1 }, { unique: true });

module.exports = mongoose.model("Variant", variantSchema);
