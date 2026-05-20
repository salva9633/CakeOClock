import Review from "../../models/reviewModel.js";
import Order  from "../../models/orderModel.js";
 
/* ===============================
   POST /add-review   (userAuth)
================================ */
const addReview = async (req, res) => {
  try {
    const userId = req.session?.user?.id || req.session?.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Login required." });
    }
 
    const { productId, comment, rating } = req.body;
 
    const ratingNum = Number(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5." });
    }
 
    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, message: "Review comment cannot be empty." });
    }
 
    const deliveredOrder = await Order.findOne({
      userId,
      items: {
        $elemMatch: {
          productId: productId,
          status:    "Delivered"
        }
      }
    }).lean();
 
    if (!deliveredOrder) {
      return res.status(403).json({
        success: false,
        message: "You can only review products from your delivered orders."
      });
    }
 
    
    await Review.create({
      productId,
      userId,
      rating:  ratingNum,
      comment: comment.trim()
    });
 
    
    const allReviews   = await Review.find({ productId }).lean();
    const totalReviews = allReviews.length;
    const avgRating    = (
      allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews
    ).toFixed(1);
 
    return res.json({ success: true, avgRating, totalReviews });
 
  } catch (error) {
    console.error("addReview error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
 
/* ===============================
   GET /reviews/:productId
================================ */
const getReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ productId: req.params.productId })
      .populate("userId", "name")
      .sort({ createdAt: -1 })
      .lean();
 
    return res.json({ success: true, reviews });
  } catch (error) {
    console.error("getReviews error:", error);
    return res.status(500).json({ success: false });
  }
};
 
export { addReview, getReviews };
 