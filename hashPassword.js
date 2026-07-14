// hashPassword.js  (at project root, next to app.js)
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "./models/userModel.js";   // <-- ./ not ../ since this file is at root

dotenv.config();

const ADMIN_EMAIL = "admin@gmail.com";        // your real admin login email
const NEW_PASSWORD = "A#coc@S9633"; // <-- type your own password here

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI); // check .env for the exact variable name

    const hashed = await bcrypt.hash(NEW_PASSWORD, 10);

    const result = await User.findOneAndUpdate(
      { email: ADMIN_EMAIL, isAdmin: true },
      { $set: { password: hashed } },
      { new: true }
    );

    if (!result) {
      console.log("❌ No admin found with that email/isAdmin:true. Check ADMIN_EMAIL.");
    } else {
      console.log("✅ Password updated for:", result.email);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
};

run();