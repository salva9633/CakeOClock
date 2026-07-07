import mongoose from "mongoose";

const messageEntrySchema = new mongoose.Schema({
  sender:    { type: String, enum: ['user', 'admin'], required: true },
  text:      { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const contactMessageSchema = new mongoose.Schema({
  ticketNumber: { type: String, unique: true, index: true },

  name:    { type: String, required: true, trim: true },
  email:   { type: String, required: true, trim: true, lowercase: true },
  subject: { type: String, required: true, trim: true },

  messages: { type: [messageEntrySchema], default: [] },

  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },

  resolvedAt:     { type: Date, default: null },
  closedAt:       { type: Date, default: null },
  lastActivityAt: { type: Date, default: Date.now },

  unreadAdminCount: { type: Number, default: 0 },
  unreadUserCount:  { type: Number, default: 0 },

}, { timestamps: true });

// Auto-generate a human-friendly ticket number on creation
// AFTER (correct for Mongoose 7+)
contactMessageSchema.pre('validate', function () {
  if (!this.ticketNumber) {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    this.ticketNumber = `CO-${year}-${rand}`;
  }
});

// Lazy auto-close: call on every fetch before rendering.
// Returns true if status changed (caller should .save()).
const RESOLVE_GRACE_DAYS = 3;

contactMessageSchema.methods.applyAutoClose = function () {
  if (this.status === 'resolved' && this.resolvedAt) {
    const graceMs = RESOLVE_GRACE_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - new Date(this.resolvedAt).getTime() > graceMs) {
      this.status = 'closed';
      this.closedAt = new Date();
      return true;
    }
  }
  return false;
};

export default mongoose.model('ContactMessage', contactMessageSchema);