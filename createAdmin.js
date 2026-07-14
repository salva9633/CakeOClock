// createAdmin.js
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "./models/userModel.js";

dotenv.config();

const ADMIN_NAME = "Admin";
const ADMIN_EMAIL = "admin@gmail.com";
const ADMIN_PASSWORD = "A#coc@S9633"; // <-- your real password

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB:", mongoose.connection.name);

    const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const existing = await User.findOne({ email: ADMIN_EMAIL });

    if (existing) {
      existing.password = hashed;
      existing.isAdmin = true;
      existing.isBlocked = false;
      await existing.save();
      console.log("✅ Existing user updated to admin:", existing.email);
    } else {
      const newAdmin = await User.create({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: hashed,
        isAdmin: true,
        isBlocked: false,
        authType: "local",
        isVerified: true
      });
      console.log("✅ New admin created:", newAdmin.email);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
};

run();