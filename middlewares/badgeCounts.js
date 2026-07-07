import Cart from "../models/cartModel.js";
import Wishlist from "../models/wishlistModel.js";
import Order from "../models/orderModel.js"; 
import ContactMessage from "../models/Contactmessagemodel.js";


export const injectBadgeCounts = async (req, res, next) => {
  try {
    res.locals.cartCount = 0;
    res.locals.wishlistCount = 0;

    if (!req.session.user) {
      return next();
    }

    const userId = req.session.user.id;
    const cart = await Cart.findOne({ userId }).lean();
    const wishlist = await Wishlist.findOne({ userId }).lean();

    if (cart && cart.items.length > 0) {
      res.locals.cartCount = cart.items.reduce(
        (sum, item) => sum + item.quantity, 0
      );
    }

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

// ADD this new export below:
export const injectAdminBadgeCounts = async (req, res, next) => {
  try {
    res.locals.pendingOrderCount = await Order.countDocuments({ status: "pending" });
  } catch (err) {
    res.locals.pendingOrderCount = 0;
  }
  next();
};