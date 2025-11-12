// Mijozlarning qarz va to'lovlarini tekshirish
require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_DB = process.env.MONGO_DB || "mongodb://localhost:27017/nasiya_db";

async function checkCustomerData() {
  try {
    await mongoose.connect(MONGO_DB);
    console.log("✅ MongoDB connected\n");

    const Customer = mongoose.model(
      "Customer",
      new mongoose.Schema({}, { strict: false })
    );
    const Contract = mongoose.model(
      "Contract",
      new mongoose.Schema({}, { strict: false })
    );
    const Payment = mongoose.model(
      "Payment",
      new mongoose.Schema({}, { strict: false })
    );

    // Shahriyor Zaripov managerining mijozlari
    const managerId = "6910bc445795842133bc8880";

    const customers = await Customer.find({
      manager: new mongoose.Types.ObjectId(managerId),
      isDeleted: false,
    });

    console.log(`📋 Manager'ning mijozlari: ${customers.length} ta\n`);

    for (const customer of customers) {
      console.log(`👤 Mijoz: ${customer.firstName} ${customer.lastName}`);
      console.log(`   ID: ${customer._id}`);
      console.log(`   Telefon: ${customer.phoneNumber}`);

      // Shartnomalarni tekshirish
      const contracts = await Contract.find({
        customer: customer._id,
        status: "active",
      });
      console.log(`   📄 Shartnomalar: ${contracts.length} ta`);

      if (contracts.length > 0) {
        for (const contract of contracts) {
          console.log(
            `      - ${contract.productName}: ${contract.totalPrice} $`
          );

          // To'lovlarni tekshirish
          const payments = await Payment.find({
            _id: { $in: contract.payments },
          });
          console.log(`        To'lovlar: ${payments.length} ta`);

          const totalPaid = payments
            .filter((p) => p.isPaid)
            .reduce((sum, p) => sum + p.amount, 0);
          console.log(`        To'langan: ${totalPaid.toFixed(2)} $`);
          console.log(
            `        Qoldiq: ${(contract.totalPrice - totalPaid).toFixed(2)} $`
          );
        }
      } else {
        console.log(`      ⚠️ Shartnomalar yo'q`);
      }
      console.log("");
    }

    await mongoose.disconnect();
    console.log("✅ Tugadi");
  } catch (error) {
    console.error("❌ Xatolik:", error);
    process.exit(1);
  }
}

checkCustomerData();
