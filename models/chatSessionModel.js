import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const chatSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    messages: {
      type: [chatMessageSchema],
      default: [],
    },

    // Session is considered expired after this timestamp.
    // This is updated whenever the user sends a new message.
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// MongoDB automatically removes expired documents.
// Application code will ALSO check expiresAt so we don't
// depend on MongoDB's TTL monitor timing.
chatSessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

const ChatSession = mongoose.model("ChatSession", chatSessionSchema);

export default ChatSession;