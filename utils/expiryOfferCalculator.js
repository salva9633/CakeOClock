function calculateSafeOffer(variant) {
  const MAX_DISCOUNT = 40;     // %
  const MIN_PROFIT = 8;       // %

  const minAllowedPrice =
    variant.costPrice + (variant.costPrice * MIN_PROFIT) / 100;

  let discountedPrice =
    variant.salePrice - (variant.salePrice * MAX_DISCOUNT) / 100;

  if (discountedPrice < minAllowedPrice) {
    discountedPrice = Math.ceil(minAllowedPrice);
  }

  const discountPercent = Math.round(
    ((variant.salePrice - discountedPrice) / variant.salePrice) * 100
  );

  return {
    offerPrice: discountedPrice,
    discountPercent
  };
}

module.exports = calculateSafeOffer;
