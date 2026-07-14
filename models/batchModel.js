import mongoose from "mongoose";

const batchSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
      required: true
    },
    manufacturedAt: {
      type: Date,
      required: true
    },
    expiryAt: {
      type: Date,
      required: true
    },
    initialStock: {
      type: Number,
      required: true
    },
    availableStock: {
      type: Number,
      required: true
    },
    totalSold: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ["active", "expired", "exhausted"],
      default: "active"
    }
  },
  { timestamps: true }
);

batchSchema.statics.markExpiredBatches = async function () {
  const today = new Date();
  await this.updateMany(
    { expiryAt: { $lt: today }, status: "active" },
    { $set: { status: "expired" } } // don't touch availableStock or totalSold
  );
};

/* FIFO + expiry performance */
batchSchema.index({ variantId: 1, manufacturedAt: 1 });
batchSchema.index({ expiryAt: 1 });

export default mongoose.model("Batch", batchSchema);