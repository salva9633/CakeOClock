import mongoose from "mongoose";

const walletSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  balance: {
    type: Number,
    default: 0,
  },

  transactions: [
    {
      amount: Number,

      type: {
        type: String,
        enum: ["Credit", "Debit"],
      },

      description: String,

      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],

}, { timestamps: true });

export default mongoose.model("Wallet", walletSchema);