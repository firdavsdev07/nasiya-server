// Mijozlarni asl manageriga qaytarish
require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_DB = process.env.MONGO_DB || "mongodb://localhost:27017/nasiya_db";

async function restoreCustomers() {
  try {
    await mongoose.connect(MONGO_DB);
    console.log("✅ MongoDB connected");

    const Customer = mongoose.model(
      "Customer",
      new mongoose.Schema({}, { strict: false })
    );

    // Asl manager ID (Firdavs Normurodov)
    const originalManagerId = "69108abfe55e2a44b7ebc14b";

    const result = await Customer.updateMany(
      { isDeleted: false, isActive: true },
      { $set: { manager: new mongoose.Types.ObjectId(originalManagerId) } }
    );

    console.log(
      `✅ ${result.modifiedCount} ta mijoz asl manageriga qaytarildi`
    );

    await mongoose.disconnect();
    console.log("✅ Tugadi");
  } catch (error) {
    console.error("❌ Xatolik:", error);
    process.exit(1);
  }
}

restoreCustomers();
