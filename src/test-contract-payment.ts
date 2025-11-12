import "dotenv/config";
import connectDB from "./config/db";
import Payment from "./schemas/payment.schema";
import Contract from "./schemas/contract.schema";
import Customer from "./schemas/customer.schema";
import Employee from "./schemas/employee.schema";

async function testContractPayment() {
  try {
    await connectDB();
    console.log("✅ Connected to database");

    // 1. Bitta to'langan payment topish
    const payment = await Payment.findOne({ isPaid: true })
      .populate("customerId", "firstName lastName")
      .populate("managerId", "firstName lastName")
      .lean();

    if (!payment) {
      console.log("⚠️ No paid payment found");
      return;
    }

    console.log("\n📋 Payment found:");
    console.log("  ID:", payment._id);
    console.log("  Amount:", payment.amount);
    console.log(
      "  Customer:",
      (payment.customerId as any)?.firstName,
      (payment.customerId as any)?.lastName
    );
    console.log(
      "  Manager:",
      (payment.managerId as any)?.firstName,
      (payment.managerId as any)?.lastName
    );

    // 2. Bu payment uchun contract topish
    const contract = await Contract.findOne({
      payments: payment._id,
    })
      .select("_id productName totalPrice monthlyPayment")
      .lean();

    if (contract) {
      console.log("\n✅ Contract found:");
      console.log("  ID:", contract._id);
      console.log("  Product:", contract.productName);
      console.log("  Total Price:", contract.totalPrice);
      console.log("  Monthly Payment:", contract.monthlyPayment);
    } else {
      console.log("\n❌ Contract NOT FOUND for this payment");
      console.log("  This means the payment is not linked to any contract");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

testContractPayment();
