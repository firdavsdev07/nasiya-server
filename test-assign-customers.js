// Test script: Mijozlarni managerga biriktirish
require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_DB = process.env.MONGO_DB || "mongodb://localhost:27017/nasiya_db";

async function assignCustomers() {
  try {
    await mongoose.connect(MONGO_DB);
    console.log("✅ MongoDB connected");

    const Customer = mongoose.model(
      "Customer",
      new mongoose.Schema({}, { strict: false })
    );
    const Employee = mongoose.model(
      "Employee",
      new mongoose.Schema({}, { strict: false })
    );

    // Shahriyor Zaripov managerini topish
    const manager = await Employee.findOne({
      phoneNumber: "+998910122077",
      isActive: true,
    });

    if (!manager) {
      console.log("❌ Manager topilmadi");
      process.exit(1);
    }

    console.log("✅ Manager topildi:", manager.firstName, manager.lastName);
    console.log("   Manager ID:", manager._id.toString());

    // Barcha mijozlarni ko'rish
    const allCustomers = await Customer.find({ isDeleted: false }).limit(10);
    console.log(`\n📋 Bazada ${allCustomers.length} ta mijoz bor:`);

    allCustomers.forEach((customer, index) => {
      console.log(
        `   ${index + 1}. ${customer.firstName} ${
          customer.lastName
        } - Manager: ${customer.manager || "yo'q"}`
      );
    });

    // Agar mijozlar bo'lsa, ularni managerga biriktirish
    if (allCustomers.length > 0) {
      const result = await Customer.updateMany(
        { isDeleted: false, isActive: true },
        { $set: { manager: manager._id } }
      );

      console.log(
        `\n✅ ${result.modifiedCount} ta mijoz managerga biriktirildi`
      );
    } else {
      console.log("\n⚠️ Bazada mijozlar yo'q. Test mijoz yaratish kerak.");
    }

    await mongoose.disconnect();
    console.log("\n✅ Tugadi");
  } catch (error) {
    console.error("❌ Xatolik:", error);
    process.exit(1);
  }
}

assignCustomers();
