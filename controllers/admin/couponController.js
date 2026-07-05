import Coupon from "../../models/couponModel.js";
import { renderAdmin } from "../../utils/renderAdmin.js";

const loadCoupons = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    const totalCoupons = await Coupon.countDocuments();
    const coupons = await Coupon.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
    const totalPages = Math.ceil(totalCoupons / limit);

renderAdmin(req, res, "coupons", { coupons, currentPage: page, totalPages, totalCoupons });  } catch (error) {
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
      description,
    } = req.body;

    
    if (!code || !discountType || !discountValue || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    
    if (Number(discountValue) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Discount must be greater than 0",
      });
    }

    if (
      discountType === "percentage" &&
      Number(discountValue) > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Percentage cannot exceed 100",
      });
    }

    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(expiryDate);

    if (expiry <= today) {
      return res.status(400).json({
        success: false,
        message: "Expiry date must be a future date",
      });
    }

    
    const existingCoupon = await Coupon.findOne({
      code: code.toUpperCase(),
    });

    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: "Coupon already exists",
      });
    }

    const coupon = new Coupon({
      code: code.toUpperCase(),
      discountType,
      discountValue: Number(discountValue),
      minPurchase: Number(minPurchase) || 0,
      maxDiscount: Number(maxDiscount) || 0,
      usageLimit: Number(usageLimit) || 0,
      expiryDate,
      description,
      isFirstOrderOnly: req.body.isFirstOrderOnly === "true",
    });

    await coupon.save();

    res.redirect("/admin/coupons");
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;

    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    await Coupon.findByIdAndDelete(couponId);

    res.redirect("/admin/coupons");
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.json({
      success: true,
      isActive: coupon.isActive,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    
    const existingCoupon = await Coupon.findOne({
      code: req.body.code.toUpperCase(),
      _id: { $ne: id },
    });

    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: "Coupon code already exists",
      });
    }

    
    if (Number(req.body.discountValue) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Discount must be greater than 0",
      });
    }

    if (
      req.body.discountType === "percentage" &&
      Number(req.body.discountValue) > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Percentage cannot exceed 100",
      });
    }

    await Coupon.findByIdAndUpdate(
      id,
      {
        code: req.body.code.toUpperCase(),
        discountType: req.body.discountType,
        discountValue: Number(req.body.discountValue),
        minPurchase: Number(req.body.minPurchase) || 0,
        maxDiscount: Number(req.body.maxDiscount) || 0,
        usageLimit: Number(req.body.usageLimit) || 0,
        expiryDate: req.body.expiryDate,
        description: req.body.description,
        isFirstOrderOnly: req.body.isFirstOrderOnly === "true",
      },
      { runValidators: true }
    );

    res.redirect("/admin/coupons");
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const loadEditCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.redirect("/admin/coupons");
    }

renderAdmin(req, res, "editCoupons", { coupon });
  } catch (error) {
    console.log(error);
    res.redirect("/admin/error");
  }
};

export {
  loadCoupons,
  addCoupon,
  deleteCoupon,
  toggleCouponStatus,
  updateCoupon,
  loadEditCoupon,
};