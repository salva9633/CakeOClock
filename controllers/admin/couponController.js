
import Coupon from "../../models/couponModel.js"

const loadCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.render("coupons", { coupons });
  } catch (error) {
    console.log(error);
    res.redirect("/admin/error");
  }
};

const addCoupon = async (req, res) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      minPurchase,
      maxDiscount,
      usageLimit,
      expiryDate,
      description
    } = req.body;

    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({ success: false, message: "Coupon already exists" });
    }

    const isFirstOrderOnly = req.body.isFirstOrderOnly === 'true';

    const coupon = new Coupon({
      code,
      discountType,
      discountValue: Number(discountValue),
      minPurchase:   Number(minPurchase)  || 0,
      maxDiscount:   Number(maxDiscount)  || 0,
      usageLimit:    Number(usageLimit)   || 0,
      expiryDate,
      description,
      isFirstOrderOnly
    });

    await coupon.save();
    res.redirect("/admin/coupons");

  } catch (error) {
    console.log(error);
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    await Coupon.findByIdAndDelete(couponId);
    res.redirect("/admin/coupons");
  } catch (error) {
    console.log(error);
    res.redirect("/admin/error");
  }
};

const toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }
    coupon.isActive = !coupon.isActive;
    await coupon.save();
    res.json({ success: true, isActive: coupon.isActive });
  } catch (error) {
    console.log(error);
  }
};

const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    await Coupon.findByIdAndUpdate(id, {
      code: req.body.code,
      discountType: req.body.discountType,
      discountValue: req.body.discountValue,
      minPurchase: req.body.minPurchase,
      maxDiscount: req.body.maxDiscount,
      usageLimit: req.body.usageLimit,
      expiryDate: req.body.expiryDate,
      description: req.body.description,
        isFirstOrderOnly: req.body.isFirstOrderOnly === 'true'  // ← add this line

    });
    res.redirect("/admin/coupons");
  } catch (error) {
    console.log(error);
  }
};

const loadEditCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.redirect("coupons");
    res.render("editCoupons", { coupon });
  } catch (error) {
    console.log(error);
    res.redirect("/admin/error");
  }
};
export { loadCoupons, addCoupon, deleteCoupon, toggleCouponStatus, updateCoupon, loadEditCoupon };