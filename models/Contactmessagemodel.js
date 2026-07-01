
import mongoose from "mongoose";
 
const contactMessageSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true },
  email:   { type: String, required: true, trim: true, lowercase: true },
  subject: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
 
  status: {
    type: String,
    enum: ['unread', 'read', 'replied'],
    default: 'unread'
  },
 
  adminReply: {
    text:      { type: String, default: null },
    repliedAt: { type: Date,   default: null }
  }
 
}, { timestamps: true });
 
export default mongoose.model('ContactMessage', contactMessageSchema);
 