import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true
    },

    amount: {
      type: Number,
      required: true
    },

    description: {
      type: String,
      required: true
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null
    },

    balanceAfter: {
      type: Number,
      required: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("WalletTransaction", walletTransactionSchema);