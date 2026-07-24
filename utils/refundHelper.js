/**
 * refundHelper.js
 *
 * Shared logic for:
 *  1. Allocating a coupon discount proportionally across order items at checkout.
 *  2. Computing the correct refund amount for a cancelled/returned item.
 *
 * IMPORTANT: allocateCouponAcrossItems() is only ever called ONCE, at order
 * creation time. The resulting allocatedCouponDiscount / effectivePaidAmount
 * on each item are then immutable — they must never be recalculated later,
 * even after other items in the same order are cancelled or returned.
 */

/**
 * Distribute a total coupon discount proportionally across items based on
 * each item's subtotal (price * quantity). Rounds to 2 decimals and assigns
 * any leftover paise to the last eligible item so allocations sum exactly
 * to totalDiscount.
 *
 * @param {Array<{price:number, quantity:number}>} items
 * @param {number} totalDiscount
 * @returns {Array} items with allocatedCouponDiscount + effectivePaidAmount added
 */
export function allocateCouponAcrossItems(items, totalDiscount) {
  const round2 = (n) => Math.round(n * 100) / 100;

  if (!totalDiscount || totalDiscount <= 0) {
    return items.map((item) => ({
      ...item,
      allocatedCouponDiscount: 0,
      effectivePaidAmount: round2(item.price * item.quantity)
    }));
  }

  const eligibleTotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  if (eligibleTotal <= 0) {
    return items.map((item) => ({
      ...item,
      allocatedCouponDiscount: 0,
      effectivePaidAmount: 0
    }));
  }

  let allocatedSoFar = 0;

  return items.map((item, idx) => {
    const subtotal = round2(item.price * item.quantity);
    let share;

    if (idx === items.length - 1) {
      // Last item absorbs the rounding remainder so the total matches exactly.
      share = round2(totalDiscount - allocatedSoFar);
    } else {
      share = round2((subtotal / eligibleTotal) * totalDiscount);
      allocatedSoFar += share;
    }

    return {
      ...item,
      allocatedCouponDiscount: share,
      effectivePaidAmount: round2(subtotal - share)
    };
  });
}

/**
 * Returns the correct refund amount for a single order item.
 *
 * New orders (placed after this migration) have effectivePaidAmount stored
 * at checkout — that value is authoritative and is returned as-is.
 *
 * Legacy orders (placed before this migration) never had effectivePaidAmount
 * set, so we fall back to the old on-the-fly proportional calculation for
 * backward compatibility.
 *
 * @param {object} order - full order document (or lean object)
 * @param {object} item  - the specific order item being cancelled/returned
 */
export function getItemRefundAmount(order, item) {
  if (item.effectivePaidAmount && item.effectivePaidAmount > 0) {
    return item.effectivePaidAmount;
  }

  // Also handle the zero-discount case explicitly: if this order has no
  // coupon at all, effectivePaidAmount being 0/undefined just means "no
  // discount was ever allocated" — refund the plain subtotal.
  const hasCoupon = Boolean(order.coupon?.code || order.couponCode);
  if (!hasCoupon) {
    return Math.round(item.price * item.quantity * 100) / 100;
  }

  // Legacy fallback: recompute this item's historical discount share
  // on the fly, the way the pre-migration code used to.
  const orderItemTotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const itemSubtotal = item.price * item.quantity;
  const totalDiscount = order.coupon?.totalDiscount ?? order.discount ?? 0;
  const discountShare =
    orderItemTotal > 0 ? Math.round((itemSubtotal / orderItemTotal) * totalDiscount) : 0;

  return Math.max(0, itemSubtotal - discountShare);
}

/**
 * Re-checks coupon eligibility after a cancellation/return WITHOUT touching
 * any stored allocations. Only flips coupon.isStillEligible for reporting.
 *
 * @param {object} order - order document with order.coupon and order.items
 * @param {number} remainingEligibleTotal - sum of subtotals of still-active items
 */
export function refreshCouponEligibility(order, remainingEligibleTotal) {
  if (!order.coupon || !order.coupon.code) return;
  order.coupon.isStillEligible = remainingEligibleTotal >= (order.coupon.minimumPurchase || 0);
}

/**
 * Sum of allocatedCouponDiscount across a set of items (used to derive the
 * legacy `order.discount` display field after a cancellation, WITHOUT
 * recalculating any individual allocation).
 */
export function sumAllocatedDiscount(items) {
  return Math.round(items.reduce((s, i) => s + (i.allocatedCouponDiscount || 0), 0) * 100) / 100;
}