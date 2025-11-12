import "dotenv/config";
import connectDB from "../src/config/db";
import Customer from "../src/schemas/customer.schema";
import Contract from "../src/schemas/contract.schema";
import Payment from "../src/schemas/payment.schema";
import Notes from "../src/schemas/notes.schema";

async function cleanTestData() {
  try {
    console.log("=== CLEANING TEST DATA ===\n");

    await connectDB();
    console.log("✅ Connected to database\n");

    // Test ma'lumotlarini o'chirish
    const deletedCustomers = await Customer.deleteMany({
      firstName: {
        $in: [
          "UMIDA",
          "A11",
          "YASHNAR",
          "JONDOST",
          "P",
          "UMS",
          "ZABIXULLO",
          "M",
          "NODIR",
          "KB",
          "SASHA",
          "SALOH",
        ],
      },
    });

    const deletedContracts = await Contract.deleteMany({
      productName: { $regex: /IPHONE|SAMSUNG|XOLODILNIK/i },
    });

    const deletedPayments = await Payment.deleteMany({
      amount: {
        $in: [
          400, 138, 300, 160, 145, 220, 60, 260, 65, 330, 2000, 110, 170, 215,
          100, 190,
        ],
      },
    });

    const deletedNotes = await Notes.deleteMany({
      text: { $regex: /Excel'dan import|To'lov:|Boshlang'ich to'lov/i },
    });

    console.log("=== CLEANUP RESULTS ===");
    console.log(`Customers deleted: ${deletedCustomers.deletedCount}`);
    console.log(`Contracts deleted: ${deletedContracts.deletedCount}`);
    console.log(`Payments deleted: ${deletedPayments.deletedCount}`);
    console.log(`Notes deleted: ${deletedNotes.deletedCount}`);

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ ERROR:", error.message);
    process.exit(1);
  }
}

cleanTestData();
