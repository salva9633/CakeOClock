import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({

  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },

  discountType: {
    type: String,
    enum: ["percentage", "fixed"],
    required: true
  },

  discountValue: {
    type: Number,
    required: true
  },

  minPurchase: {
    type: Number,
    default: 0
  },

  maxDiscount: {
    type: Number,
    default: 0
  },

  usageLimit: {
    type: Number,
    default: 0
  },

  description: {
    type: String,
    default: ""
  },

  expiryDate: {
    type: Date,
    required: true
  },

  isActive: {
    type: Boolean,
    default: true
  },

  isDeleted: {
    type: Boolean,
    default: false
  },

  
  isFirstOrderOnly: {
    type: Boolean,
    default: false
  },

  // Users who used this coupon
  usedBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ],

  
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  }

}, { timestamps: true });

export default mongoose.model("Coupon", couponSchema);