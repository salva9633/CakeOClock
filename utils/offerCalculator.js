// utils/offerCalculator.js
import Product from "../models/productModel.js";

export const getFinalPrice = async (variant) => {
  const product = await Product.findById(variant.productId)
    .populate("categoryId")
    .lean();

  const productOffer  = product?.productOffer  || 0;
  const categoryOffer = product?.categoryId?.categoryOffer || 0;

  const bestDiscount = Math.max(productOffer, categoryOffer);

  const base = variant.regularPrice;
  const finalPrice = bestDiscount > 0
    ? Math.round(base - (base * bestDiscount / 100))
    : base;

  return {
    originalPrice:   base,
    finalPrice,
    discountPercent: bestDiscount,
    offerApplied:    bestDiscount > 0,
    activeOfferLabel: categoryOffer > productOffer ? "category" : "product"
  };
};