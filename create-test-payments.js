// Script to create test pending payments
require("dotenv").config();
const mongoose = require("mongoose");

async function createTestPayments() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    const mongoUri =
      process.env.MONGO_DB || "mongodb://localhost:27017/nasiya_db";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // Get models
    const Payment = mongoose.model(
      "Payment",
      new mongoose.Schema({}, { strict: false })
    );
    const Customer = mongoose.model(
      "Customer",
      new mongoose.Schema({}, { strict: false })
    );
    const Employee = mongoose.model(
      "Employee",
      new mongoose.Schema({}, { strict: false })
    );
    const Notes = mongoose.model(
      "Notes",
      new mongoose.Schema({}, { strict: false })
    );

    // Find a customer
    const customer = await Customer.findOne();
    if (!customer) {
      console.log("❌ No customers found. Please create a customer first.");
      await mongoose.disconnect();
      return;
    }
    console.log("✅ Found customer:", customer.firstName, customer.lastName);

    // Find a manager
    const manager = await Employee.findOne({
      role: { $exists: true },
    }).populate("role");

    if (!manager) {
      console.log("❌ No managers found. Please create a manager first.");
      await mongoose.disconnect();
      return;
    }
    console.log("✅ Found manager:", manager.firstName, manager.lastName);

    // Create notes
    const notes1 = await Notes.create({
      text: "Test to'lov 1 - Manager tomonidan qabul qilindi",
      customer: customer._id,
      createBy: manager._id,
    });

    const notes2 = await Notes.create({
      text: "Test to'lov 2 - Manager tomonidan qabul qilindi",
      customer: customer._id,
      createBy: manager._id,
    });

    const notes3 = await Notes.create({
      text: "Test to'lov 3 - Manager tomonidan qabul qilindi",
      customer: customer._id,
      createBy: manager._id,
    });

    // Create 3 pending payments
    const payment1 = await Payment.create({
      amount: 500000,
      date: new Date(),
      isPaid: false,
      paymentType: "monthly",
      customerId: customer._id,
      managerId: manager._id,
      notes: notes1._id,
      status: "PENDING",
      expectedAmount: 500000,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const payment2 = await Payment.create({
      amount: 750000,
      date: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      isPaid: false,
      paymentType: "monthly",
      customerId: customer._id,
      managerId: manager._id,
      notes: notes2._id,
      status: "PENDING",
      expectedAmount: 750000,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const payment3 = await Payment.create({
      amount: 1000000,
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      isPaid: false,
      paymentType: "monthly",
      customerId: customer._id,
      managerId: manager._id,
      notes: notes3._id,
      status: "PENDING",
      expectedAmount: 1000000,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });

    console.log("\n✅ Created 3 test pending payments:");
    console.log("1. Payment ID:", payment1._id, "- Amount:", payment1.amount);
    console.log("2. Payment ID:", payment2._id, "- Amount:", payment2.amount);
    console.log("3. Payment ID:", payment3._id, "- Amount:", payment3.amount);

    // Verify
    const pendingCount = await Payment.countDocuments({
      isPaid: false,
      status: "PENDING",
    });
    console.log("\n📊 Total pending payments now:", pendingCount);

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

createTestPayments();
