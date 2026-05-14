import mongoose from "mongoose";
 
const orderItemSchema = new mongoose.Schema({
  productId:    { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  variantId:    { type: mongoose.Schema.Types.ObjectId, ref: "Variant" },
  productName:  { type: String, required: true },
  productImage: { type: String },
  weight:       { type: Number },
  quantity:     { type: Number, required: true },
  price:        { type: Number, required: true },
  regularPrice: { type: Number },
  status: {
    type: String,
    enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Returned"],
    default: "Pending"
  },
  cancelReason: { type: String, default: null },
  returnReason: { type: String, default: null }
});
 
const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },
 
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
 
  address: {
    name:     { type: String, required: true },
    phone:    { type: String, required: true },
    street:   { type: String, required: true },
    address:  { type: String },
    landmark: { type: String },
    city:     { type: String, required: true },
    state:    { type: String, required: true },
    pincode:  { type: String, required: true },
    type:     { type: String }
  },
 
  items: [orderItemSchema],
 
  paymentMethod: { type: String, enum: ["COD", "Online"], default: "COD" },
  paymentStatus: { type: String, enum: ["Pending", "Paid", "Failed"], default: "Pending" },
 
  itemTotal:      { type: Number, required: true },
  discount:       { type: Number, default: 0 },
  tax:            { type: Number, default: 0 },
  shippingCharge: { type: Number, default: 0 },
  finalTotal:     { type: Number, required: true },
 
  status: {
    type: String,
    enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Returned"],
    default: "Pending"
  },
 
  cancelReason: { type: String, default: null },
  returnReason: { type: String, default: null }
 
}, { timestamps: true });
 
orderSchema.pre("save", async function () {
  if (this.isNew) {
    const date = new Date();

    const ymd = `${date.getFullYear()}${String(
      date.getMonth() + 1
    ).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

    const count = await mongoose.model("Order").countDocuments();

    this.orderId = `ORD-${ymd}-${String(count + 1).padStart(4, "0")}`;
  }
});
 
export default mongoose.model("Order", orderSchema);