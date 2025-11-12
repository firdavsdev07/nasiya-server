import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../src/config/db";
import Customer from "../src/schemas/customer.schema";
import Contract from "../src/schemas/contract.schema";
import Payment from "../src/schemas/payment.schema";
import dayjs from "dayjs";

async function checkPaymentDates(): Promise<void> {
  try {
    console.log("=== CHECKING PAYMENT DATES ===\n");

    await connectDB();

    // YASHNAR FAYZULLA mijozini topish
    const customer = await Customer.findOne({
      firstName: "YASHNAR",
      lastName: "FAYZULLA",
    });

    if (!customer) {
      console.log("❌ Customer not found");
      return;
    }

    console.log(
      `✅ Found customer: ${customer.firstName} ${customer.lastName}`
    );

    // Shartnomani topish
    const contract = await Contract.findOne({
      customer: customer._id,
    });

    if (!contract) {
      console.log("❌ Contract not found");
      return;
    }

    console.log(`\n📋 Contract:`);
    console.log(
      `  Start Date: ${dayjs(contract.startDate).format("YYYY-MM-DD")}`
    );
    console.log(`  Start Day: ${dayjs(contract.startDate).date()}`);
    console.log(`  Product: ${contract.productName}`);
    console.log(`  Monthly Payment: ${contract.monthlyPayment}$`);

    // To'lovlarni topish
    const payments = await Payment.find({
      _id: { $in: contract.payments },
    }).sort({ date: 1 });

    console.log(`\n💰 Payments (${payments.length}):`);

    for (const paymentDoc of payments) {
      console.log(
        `  - ${dayjs(paymentDoc.date).format("YYYY-MM-DD")} (Day: ${dayjs(
          paymentDoc.date
        ).date()}) - ${paymentDoc.amount}$ - ${paymentDoc.paymentType}`
      );
    }
  } catch (error: any) {
    console.error("\n❌ ERROR:", error.message);
    throw error;
  }
}

checkPaymentDates()
  .then(async () => {
    console.log("\n✅ Check completed");
    await mongoose.connection.close();
  })
  .catch(async (error) => {
    console.error("\n❌ Check failed:", error);
    await mongoose.connection.close();
  });
