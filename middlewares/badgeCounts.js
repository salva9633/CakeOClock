import Cart from "../models/cartModel.js";
import Wishlist from "../models/wishlistModel.js";

export const injectBadgeCounts = async (req, res, next) => {
  try {

    // Default values
    res.locals.cartCount = 0;
    res.locals.wishlistCount = 0;

    // No user logged in
    if (!req.session.user) {
      return next();
    }

    const userId = req.session.user.id;

    // Get cart
    const cart = await Cart.findOne({ userId }).lean();

    // Get wishlist
    const wishlist = await Wishlist.findOne({ userId }).lean();

    // Cart count
    if (cart && cart.items.length > 0) {
      res.locals.cartCount = cart.items.reduce(
        (sum, item) => sum + item.quantity,
        0
      );
    }

    // Wishlist count
    if (wishlist && wishlist.products.length > 0) {
      res.locals.wishlistCount = wishlist.products.length;
    }

    next();

  } catch (err) {
    console.error("BADGE COUNT ERROR:", err);

    res.locals.cartCount = 0;
    res.locals.wishlistCount = 0;

    next();
  }
};