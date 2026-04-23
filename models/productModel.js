import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    discount: {
      type: Number,
      default: 0
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
      default: []
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

export default mongoose.model("Product", productSchema);
