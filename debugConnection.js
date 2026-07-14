// debugConnection.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/userModel.js";

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  console.log("Connected to DB:", mongoose.connection.name);
  console.log("Connected host:", mongoose.connection.host);
  console.log("User model's collection name:", User.collection.name);

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log("All collections in this DB:", collections.map(c => c.name));

  const usersCount = await mongoose.connection.db.collection("users").countDocuments();
  const adminsCount = await mongoose.connection.db.collection("admins").countDocuments();
  console.log("Docs in 'users' collection:", usersCount);
  console.log("Docs in 'admins' collection:", adminsCount);

  await mongoose.disconnect();
  process.exit();
};

run();