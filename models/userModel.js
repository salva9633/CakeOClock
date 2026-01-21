const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    email: {
      type: String,
      unique: true,
      required: true
    },

    phone: {
      type: String,
      unique: true,
      sparse: true
    },

    googleId: {
      type: String,
      default: null
    },

    googleImage: {
      type: String,
      default: null
    },

    password: {
      type: String
    },

    isBlocked: {
      type: Boolean,
      default: false
    },

    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other"
    },

    profileImage: {
      type: String,
      default: null
    },

    authType: {
      type: String,
      enum: ["local", "google"],
      default: "local"
    },

    isAdmin: {
      type: Boolean,
      default: false
    },

    isVerified: {
      type: Boolean,
      default: false
    },

    
    addresses: [
      {
        name: {
          type: String,
          required: true
        },
        phone: {
          type: String,
          required: true
        },
        street: {
          type: String,
          required: true
        },
        city: {
          type: String,
          required: true
        },
        state: {
          type: String
        },
        pincode: {
          type: String,
          required: true
        },
        type: {
          type: String,
          enum: ["HOME", "WORK"],
          default: "HOME"
        },
        isDefault: {
          type: Boolean,
          default: false
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);
