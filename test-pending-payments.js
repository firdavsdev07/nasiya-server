// Test script to check pending payments
require("dotenv").config();
const mongoose = require("mongoose");

async function testPendingPayments() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    const mongoUri =
      process.env.MONGO_DB || "mongodb://localhost:27017/nasiya_db";
    console.log("MongoDB URI:", mongoUri);
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    const Payment = mongoose.model(
      "Payment",
      new mongoose.Schema({}, { strict: false })
    );

    // Count all payments
    const totalPayments = await Payment.countDocuments();
    console.log("\n📊 Total payments:", totalPayments);

    // Count pending payments
    const pendingCount = await Payment.countDocuments({
      isPaid: false,
      status: "PENDING",
    });
    console.log("📊 Pending payments:", pendingCount);

    // Count paid payments
    const paidCount = await Payment.countDocuments({ isPaid: true });
    console.log("📊 Paid payments:", paidCount);

    // Get sample pending payment
    if (pendingCount > 0) {
      const samplePayment = await Payment.findOne({
        isPaid: false,
        status: "PENDING",
      }).lean();

      console.log("\n📋 Sample pending payment:");
      console.log(JSON.stringify(samplePayment, null, 2));
    } else {
      console.log("\n⚠️ No pending payments found!");

      // Show all payments
      const allPayments = await Payment.find().limit(5).lean();
      console.log("\n📋 Sample payments (first 5):");
      allPayments.forEach((p, i) => {
        console.log(`\n${i + 1}. Payment:`, {
          _id: p._id,
          amount: p.amount,
          isPaid: p.isPaid,
          status: p.status,
          date: p.date,
        });
      });
    }

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

testPendingPayments();
