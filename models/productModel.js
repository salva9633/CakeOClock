const mongoose = require("mongoose"); // ✅ MISSING LINE

const productSchema = new mongoose.Schema(
  {
    productName: {
  type: String,
  required: true,
  unique: true,
  trim: true
},
// price: {
//   type: Number,
//   required: true
// },
// discount: {
//   type: Number,
//   default: 0   // percentage (example: 20)
// },

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

module.exports = mongoose.model("Product", productSchema);
