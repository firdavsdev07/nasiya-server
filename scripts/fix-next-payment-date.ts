import "dotenv/config";
import connectDB from "../src/config/db";
import Contract from "../src/schemas/contract.schema";

/**
 * Migration script: Fix nextPaymentDate for existing contracts
 *
 * Problem: nextPaymentDate was set to initialPaymentDueDate instead of startDate + 1 month
 * Solution: Update all contracts where nextPaymentDate equals startDate
 */

async function fixNextPaymentDate() {
  try {
    console.log("🚀 Starting migration: Fix nextPaymentDate");
    console.log("=====================================\n");

    await connectDB();

    // Find all contracts where nextPaymentDate equals startDate (incorrect)
    const contracts = await Contract.find({
      isDeleted: false,
    });

    console.log(`📋 Found ${contracts.length} contracts to check\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const contract of contracts) {
      const startDate = new Date(contract.startDate);
      const currentNextPaymentDate = new Date(contract.nextPaymentDate);

      // Check if nextPaymentDate is same as startDate (incorrect)
      const isSameDate =
        startDate.getFullYear() === currentNextPaymentDate.getFullYear() &&
        startDate.getMonth() === currentNextPaymentDate.getMonth() &&
        startDate.getDate() === currentNextPaymentDate.getDate();

      if (isSameDate) {
        // Calculate correct nextPaymentDate (startDate + 1 month)
        const correctNextPaymentDate = new Date(startDate);
        correctNextPaymentDate.setMonth(correctNextPaymentDate.getMonth() + 1);

        // Update contract
        contract.nextPaymentDate = correctNextPaymentDate;
        await contract.save();

        updatedCount++;
        console.log(`✅ Updated contract ${contract._id}:`);
        console.log(`   Start Date: ${startDate.toISOString().split("T")[0]}`);
        console.log(
          `   Old Next Payment: ${
            currentNextPaymentDate.toISOString().split("T")[0]
          }`
        );
        console.log(
          `   New Next Payment: ${
            correctNextPaymentDate.toISOString().split("T")[0]
          }\n`
        );
      } else {
        skippedCount++;
      }
    }

    console.log("\n=====================================");
    console.log("✅ Migration completed!");
    console.log(`   Updated: ${updatedCount} contracts`);
    console.log(`   Skipped: ${skippedCount} contracts (already correct)`);
    console.log("=====================================\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
fixNextPaymentDate();
