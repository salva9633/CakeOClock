const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    description: {
      type: String,
      required: true,
      trim: true
    },

    image: {
      type: String,
      required: true   
    },

    isActive: {
      type: Boolean,
      default: true
    },

    offer: {
      type: Number,
      default: 0
    },
        isDeleted: {
      type: Boolean,
      default: false   
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema);
