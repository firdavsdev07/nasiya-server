import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../src/config/db";
import Contract from "../src/schemas/contract.schema";
import Payment from "../src/schemas/payment.schema";
import dayjs from "dayjs";

async function checkImportedDates() {
  try {
    await connectDB();

    console.log("=== CHECKING IMPORTED DATES ===\n");

    // Barcha shartnomalarni olish
    const contracts = await Contract.find({
      isDeleted: false,
    });

    console.log(`Found ${contracts.length} contracts\n`);

    for (const contract of contracts) {
      console.log(`━━━ CONTRACT: ${contract.productName} ━━━`);
      console.log(
        `Start Date: ${dayjs(contract.startDate).format("YYYY-MM-DD")}`
      );
      console.log(`Year: ${dayjs(contract.startDate).year()}`);

      // To'lovlarni olish
      const payments = await Payment.find({
        _id: { $in: contract.payments },
      }).sort({ date: 1 });

      console.log(`Payments: ${payments.length}`);

      for (const payment of payments) {
        const year = dayjs(payment.date).year();
        const status = year < 2020 ? "❌ XATO" : "✅";
        console.log(
          `  ${status} ${dayjs(payment.date).format("YYYY-MM-DD")} - ${
            payment.amount
          }$ - ${payment.paymentType}`
        );
      }

      console.log("");
    }

    await mongoose.connection.close();
  } catch (error: any) {
    console.error("ERROR:", error.message);
    await mongoose.connection.close();
  }
}

checkImportedDates();
