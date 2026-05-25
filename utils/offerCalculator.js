// This is the core logic — compares product offer vs category offer
// and always applies the LARGER one

const Offer = require('../models/offerModel');

const getBestOfferForProduct = async (product) => {
  const now = new Date();

  // Fetch active product-specific offer
  const productOffer = await Offer.findOne({
    offerType: 'product',
    productId: product._id,
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  });

  // Fetch active category offer for this product's category
  const categoryOffer = await Offer.findOne({
    offerType: 'category',
    categoryId: product.category,   // make sure your product has a 'category' field
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  });

  const productPercent  = productOffer  ? productOffer.discountPercent  : 0;
  const categoryPercent = categoryOffer ? categoryOffer.discountPercent : 0;

  // Rule: apply the LARGER of the two
  const bestPercent = Math.max(productPercent, categoryPercent);
  const originalPrice = product.price;
  const discountedPrice = bestPercent > 0
    ? originalPrice - (originalPrice * bestPercent) / 100
    : originalPrice;

  return {
    originalPrice,
    discountedPrice: Math.round(discountedPrice),
    discountPercent: bestPercent,
    offerApplied: bestPercent > 0
  };
};

module.exports = { getBestOfferForProduct };