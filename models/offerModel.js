const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  offerType: { type: String, enum: ['product', 'category'], required: true },
  discountPercent: { type: Number, required: true, min: 1, max: 100 },
  // Link to either a product OR category
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Offer', offerSchema);