import Batch from "../models/batchModel.js";

/**
 * Deducts `qty` units for a variant using FIFO across active batches.
 * Atomic per-batch via findOneAndUpdate guard — safe under concurrent orders.
 * Throws if there isn't enough stock (caller should already have checked,
 * but this is the last line of defense against races).
 */
export async function deductStockFIFO(variantId, qty) {
  let remaining = qty;

  const batches = await Batch.find({
    variantId,
    status: "active",
    availableStock: { $gt: 0 }
  }).sort({ manufacturedAt: 1 });

  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.availableStock, remaining);

    const updated = await Batch.findOneAndUpdate(
      { _id: batch._id, availableStock: { $gte: take } },
      { $inc: { availableStock: -take, totalSold: take } },
      { new: true }
    );

    if (!updated) continue;

    if (updated.availableStock === 0) {
      await Batch.findByIdAndUpdate(updated._id, { status: "exhausted" });
    }

    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error("Insufficient stock — please try again");
  }
}
