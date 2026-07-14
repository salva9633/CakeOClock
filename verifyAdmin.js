// verifyAdmin.js
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "./models/userModel.js";

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB:", mongoose.connection.name);
  console.log("Connected host:", mongoose.connection.host);

  const admin = await User.findOne({ email: "admin@gmail.com" });

  if (!admin) {
    console.log("❌ No user found with that email in this DB.");
  } else {
    console.log("Found user _id:", admin._id.toString());
    console.log("isAdmin:", admin.isAdmin, "isBlocked:", admin.isBlocked);
    console.log("Stored hash:", admin.password);

    const matchesNew = await bcrypt.compare("A#coc@S9633", admin.password);
    const matchesOld = await bcrypt.compare("admin@123", admin.password);

    console.log("Matches NEW password?", matchesNew);
    console.log("Matches OLD password (admin@123)?", matchesOld);
  }

  await mongoose.disconnect();
  process.exit();
};

run();