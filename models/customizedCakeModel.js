import mongoose from "mongoose";

const customizedCakeSchema = new mongoose.Schema(
  {
    // ==============================
    // USER DETAILS
    // ==============================
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    // ==============================
    // CAKE DETAILS
    // ==============================
    cakeType: {
      type: String,
      required: true,
      trim: true,
    },

    weight: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    referenceImage: {
      type: String,
      default: "",
    },

    // ==============================
    // DELIVERY / REQUIREMENT DETAILS
    // ==============================
    neededDate: {
      type: Date,
      default: null,
    },

    neededTime: {
      type: String,
      default: "",
      trim: true,
    },

    cakeMessage: {
      type: String,
      default: "",
      trim: true,
    },

    additionalRequirements: {
      type: String,
      default: "",
      trim: true,
    },

    // ==============================
    // ADMIN QUOTATION
    // ==============================
    quotedPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    adminNote: {
      type: String,
      default: "",
      trim: true,
    },

    // ==============================
    // PAYMENT STATUS
    // ==============================
    paymentStatus: {
      type: String,
      enum: [
        "pending",
        "completed",
        "failed",
        "refunded",
      ],
      default: "pending",
    },

    // ==============================
    // CUSTOM CAKE STATUS
    // ==============================
    status: {
      type: String,
      enum: [
        "pending",
        "reviewing",
        "quoted",
        "approved",
        "in-production",
        "ready",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

const CustomizedCake = mongoose.model(
  "CustomizedCake",
  customizedCakeSchema
);

export default CustomizedCake;