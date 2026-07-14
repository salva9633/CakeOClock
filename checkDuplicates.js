// checkDuplicates.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/userModel.js";

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const all = await User.find({ email: "admin@gmail.com" });
  console.log("Number of matching documents:", all.length);
  all.forEach((u, i) => {
    console.log(`Doc ${i + 1}: _id=${u._id} hash=${u.password}`);
  });
  await mongoose.disconnect();
  process.exit();
};

run();