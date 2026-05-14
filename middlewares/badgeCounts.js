import Cart from "../models/cartModel.js";
import Wishlist from "../models/wishlistModel.js";

export const injectBadgeCounts = async (req, res, next) => {
  try {

    res.locals.cartCount = 0;
    res.locals.wishlistCount = 0;

    if (req.session.user) {

      const userId = req.session.user.id;

      const cart = await Cart.findOne({ userId });

      if (cart && cart.items) {
        res.locals.cartCount =
          cart.items.reduce((total, item) => total + item.quantity, 0);
      }

      const wishlist = await Wishlist.findOne({ userId });

      if (wishlist && wishlist.products) {
        res.locals.wishlistCount = wishlist.products.length;
      }
    }

    next();

  } catch (error) {
    console.log("injectBadgeCounts error", error);
    next();
  }
};