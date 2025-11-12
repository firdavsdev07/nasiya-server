import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../src/config/db";
import Contract from "../src/schemas/contract.schema";
import Payment from "../src/schemas/payment.schema";
import Customer from "../src/schemas/customer.schema";
import { Balance } from "../src/schemas/balance.schema";
import dayjs from "dayjs";

async function finalCheck() {
  try {
    await connectDB();

    console.log("=== FINAL CHECK ===\n");

    // 1. Shartnomalar soni
    const totalContracts = await Contract.countDocuments({ isDeleted: false });
    console.log(`✅ Jami shartnomalar: ${totalContracts}`);

    // 2. To'lovlar soni
    const totalPayments = await Payment.countDocuments({ isPaid: true });
    console.log(`✅ Jami to'lovlar: ${totalPayments}`);

    // 3. Mijozlar soni
    const totalCustomers = await Customer.countDocuments({ isDeleted: false });
    console.log(`✅ Jami mijozlar: ${totalCustomers}`);

    // 4. Jami summa
    const payments = await Payment.find({ isPaid: true });
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    console.log(`✅ Jami summa: ${totalAmount.toFixed(2)}$`);

    // 5. Balance
    const balances = await Balance.find({});
    const totalBalance = balances.reduce((sum, b) => sum + b.dollar, 0);
    console.log(`✅ Jami balance: ${totalBalance.toFixed(2)}$`);

    // 6. Sanalarni tekshirish
    const oldContracts = await Contract.find({
      isDeleted: false,
      startDate: { $lt: new Date("2020-01-01") },
    });

    if (oldContracts.length > 0) {
      console.log(
        `\n❌ XATO: ${oldContracts.length} ta eski shartnoma topildi:`
      );
      for (const contract of oldContracts) {
        console.log(
          `   - ${contract.productName}: ${dayjs(contract.startDate).format(
            "YYYY-MM-DD"
          )}`
        );
      }
    } else {
      console.log(`\n✅ Barcha shartnomalar 2020+ yilda`);
    }

    // 7. To'lovlar sanalarini tekshirish
    const oldPayments = await Payment.find({
      isPaid: true,
      date: { $lt: new Date("2020-01-01") },
    });

    if (oldPayments.length > 0) {
      console.log(`\n❌ XATO: ${oldPayments.length} ta eski to'lov topildi`);
    } else {
      console.log(`✅ Barcha to'lovlar 2020+ yilda`);
    }

    // 8. Balance va to'lovlar mos kelishini tekshirish
    if (Math.abs(totalBalance - totalAmount) < 0.01) {
      console.log(`\n✅ Balance va to'lovlar mos keladi!`);
    } else {
      console.log(
        `\n⚠️ Balance va to'lovlar mos kelmaydi: ${totalBalance.toFixed(
          2
        )}$ vs ${totalAmount.toFixed(2)}$`
      );
    }

    console.log("\n✅ FINAL CHECK COMPLETED!");

    await mongoose.connection.close();
  } catch (error: any) {
    console.error("ERROR:", error.message);
    await mongoose.connection.close();
  }
}

finalCheck();
