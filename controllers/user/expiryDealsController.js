import Batch from "../../models/batchModel.js";
import calculateSafeOffer from "../../utils/expiryOfferCalculator.js";
import { categoryInfo } from "../admin/categoryController.js";

const loadNearExpiryDeals = async (req, res) => {
  try {
    const today = new Date();
    const twoDaysLater = new Date();
    twoDaysLater.setDate(today.getDate() + 2);

    const batches = await Batch.find({
  expiryAt: { $gte: today, $lte: twoDaysLater },
  availableStock: { $gt: 0 },
  status: "active"
})
  .populate({
    path: "productId",
    populate: {
      path: "categoryId"
    }
  })
  .populate("variantId")
  .lean();

    const deals = batches
      .filter(b => b.productId && b.productId.isListed)
      .map(batch => {
        const offer = calculateSafeOffer(batch.variantId);

    return {
  product: batch.productId,
  variant: batch.variantId,
  expiryAt: batch.expiryAt,
  offerPrice: offer.offerPrice,
  discountPercent: offer.discountPercent,
  stock: batch.availableStock,

  category: batch.productId.categoryId,

  avgRating: 0,
  totalReviews: 0
};   });


    res.render("near-expiry", { deals });

  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

export { loadNearExpiryDeals };




