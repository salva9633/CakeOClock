import Review from "../../models/reviewModel.js";

export const addReview = async (req, res) => {
  try {

    console.log("BODY:", req.body);
console.log("USER:", req.session.user);


    const { productId, comment } = req.body;

    const userId = req.session.user?.id || req.session.user?._id;

    if (!userId) {
      return res.json({
        success: false,
        message: "Please login"
      });
    }

    if (!comment || comment.trim() === "") {
      return res.json({
        success: false,
        message: "Comment cannot be empty"
      });
    }

    const review = await Review.create({
      userId,
      productId,
      comment: comment.trim()
    });

    res.json({ success: true, review });

  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Server error" });
  }
};

export const getReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const reviews = await Review.find({ productId })
      .populate("userId", "name")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, reviews });
  } catch (error) {
    console.error(error);
    res.json({ success: false });
  }
};