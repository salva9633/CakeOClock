import User from "../../models/userModel.js";
import WalletTransaction from "../../models/walletModel.js";
import Razorpay from "razorpay";
import crypto from "crypto";

const razorpayInstance = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ── GET /wallet ─────────────────────────────────────── */
export const loadWallet = async (req, res) => {
  try {
    const userId = req.user._id;
    const user   = await User.findById(userId);
    const page   = parseInt(req.query.page) || 1;
    const limit  = 10;
    const skip   = (page - 1) * limit;

    const totalTransactions = await WalletTransaction.countDocuments({ userId });

    const transactions = await WalletTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("orderId", "orderId");

    const totalPages = Math.ceil(totalTransactions / limit);

    res.render("wallet", {
      user,
      walletBalance:      user.walletBalance || 0,
      transactions,
      currentPage:        page,
      totalPages,
      totalTransactions,
      razorpayKeyId:      process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error("loadWallet error:", err);
    res.redirect("/profile");
  }
};

/* ── POST /wallet/create-order ───────────────────────── */
export const createWalletOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount < 1) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    const options = {
      amount:   Math.round(amount * 100),
      currency: "INR",
      receipt:  `wallet_${Date.now()}`,
    };

    const order = await razorpayInstance.orders.create(options);

    res.status(200).json({
      success:  true,
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
    });
  } catch (err) {
    console.error("createWalletOrder error:", err);
    res.status(500).json({ success: false, message: "Failed to create order" });
  }
};

/* ── POST /wallet/verify-payment ─────────────────────── */
export const verifyWalletPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount
    } = req.body;

    console.log("=== verifyWalletPayment ===");
    console.log("userId:", userId);
    console.log("amount:", amount, "type:", typeof amount);
    console.log("order_id:", razorpay_order_id);
    console.log("payment_id:", razorpay_payment_id);

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    console.log("expected:", expectedSignature);
    console.log("received:", razorpay_signature);
    console.log("match:", expectedSignature === razorpay_signature);

    if (expectedSignature !== razorpay_signature) {
      console.log("SIGNATURE MISMATCH — aborting");
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    const user = await User.findById(userId);
    console.log("user found:", !!user, "current balance:", user?.walletBalance);

    const newBalance = (user.walletBalance || 0) + Number(amount);
    console.log("newBalance will be:", newBalance);

    const updateResult = await User.findByIdAndUpdate(
      userId,
      { $set: { walletBalance: newBalance } },
      { new: true }
    );
    console.log("DB update result balance:", updateResult?.walletBalance);

    await WalletTransaction.create({
      userId,
      type:         "credit",
      amount:       Number(amount),
      description:  "Money added to wallet",
      orderId:      null,
      balanceAfter: newBalance
    });

    console.log("Transaction created successfully");

    res.status(200).json({
      success:    true,
      newBalance,
      message:    "Wallet topped up successfully"
    });
  } catch (err) {
    console.error("verifyWalletPayment error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
/* ── GET /wallet/payment-failed ──────────────────────── */
export const paymentFailed = async (req, res) => {
  const reason = req.query.reason || "Your payment could not be completed.";
  res.render("paymentFailed", { reason });
};