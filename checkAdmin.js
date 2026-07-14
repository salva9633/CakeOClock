// checkAdmin.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/userModel.js";

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const all = await User.find({}).lean();
  console.log("All users found:", JSON.stringify(all, null, 2));

  await mongoose.disconnect();
  process.exit();
};

run();