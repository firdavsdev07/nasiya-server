import "reflect-metadata";
import "dotenv/config";
import connectDB from "./config/db";
import Contract from "./schemas/contract.schema";
import debtorService from "./dashboard/services/debtor.service";

async function testDebtorCreation() {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await connectDB();
    console.log("✅ Connected to MongoDB");

    // 1. Shartnomalarni o'tmishga o'zgartirish
    console.log("\n📝 Updating contracts to overdue...");
    const result = await Contract.updateMany(
      {
        isActive: true,
        isDeleted: false,
        status: "active",
      },
      {
        $set: {
          nextPaymentDate: new Date("2025-11-01"), // O'tmishga o'zgartirish
        },
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} contracts`);

    // 2. Debtor yaratish
    console.log("\n🤖 Creating debtors...");
    const debtorResult = await debtorService.createOverdueDebtors();
    console.log(`✅ Created ${debtorResult.created} debtors`);

    // 3. Natijalarni ko'rsatish
    const { Debtor } = await import("./schemas/debtor.schema");
    const debtors = await Debtor.find().populate("contractId");
    console.log("\n📊 Total debtors in database:", debtors.length);

    if (debtors.length > 0) {
      console.log("\n📋 Sample debtor:");
      console.log({
        id: debtors[0]._id,
        contractId: debtors[0].contractId._id,
        debtAmount: debtors[0].debtAmount,
        dueDate: debtors[0].dueDate,
        overdueDays: debtors[0].overdueDays,
      });
    }

    console.log("\n✅ Test completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

testDebtorCreation();
