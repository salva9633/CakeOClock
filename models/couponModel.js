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
  },

  // Reserved for future support of product/category-scoped coupons.
  // Not yet enforced anywhere in the checkout/allocation logic — all
  // coupons currently behave as ORDER-level. Safe to add now so the
  // schema doesn't need another migration later.
  applyOn: {
    type: String,
    enum: ["ORDER", "PRODUCT", "CATEGORY"],
    default: "ORDER"
  }

}, { timestamps: true });

export default mongoose.model("Coupon", couponSchema);