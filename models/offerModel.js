import mongoose from "mongoose";

const offerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  offerType: { type: String, enum: ['product', 'category'], required: true },
  discountPercent: { type: Number, required: true, min: 1, max: 100 },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Offer = mongoose.model('Offer', offerSchema);
export default Offer;