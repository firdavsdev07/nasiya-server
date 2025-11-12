import "reflect-metadata";
import "dotenv/config";
import connectDB from "./config/db";
import Contract from "./schemas/contract.schema";
import Payment, { PaymentStatus, PaymentType } from "./schemas/payment.schema";
import Notes from "./schemas/notes.schema";

async function testPaymentCreation() {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await connectDB();
    console.log("✅ Connected to MongoDB");

    // 1. Aktiv shartnomalarni topish
    console.log("\n📝 Finding active contracts...");
    const contracts = await Contract.find({
      isActive: true,
      isDeleted: false,
      status: "active",
    }).limit(2);

    console.log(`✅ Found ${contracts.length} contracts`);

    if (contracts.length === 0) {
      console.log("❌ No contracts found!");
      process.exit(1);
    }

    // 2. Har bir shartnoma uchun PENDING to'lov yaratish
    console.log("\n💰 Creating PENDING payments...");
    let createdCount = 0;

    for (const contract of contracts) {
      // Notes yaratish
      const notes = await Notes.create({
        text: `Test to'lov: ${contract.productName} uchun oylik to'lov`,
        customer: contract.customer,
        createBy: contract.createBy,
      });

      // PENDING to'lov yaratish
      const payment = await Payment.create({
        amount: contract.monthlyPayment,
        date: new Date(),
        isPaid: false, // ❌ Hali tasdiqlanmagan
        paymentType: PaymentType.MONTHLY,
        customerId: contract.customer,
        managerId: contract.createBy,
        notes: notes._id,
        status: PaymentStatus.PENDING, // ⏳ Kassa tasdiqlashi kutilmoqda
        expectedAmount: contract.monthlyPayment,
      });

      console.log(`✅ Created PENDING payment for contract: ${contract._id}`);
      console.log(`   Amount: ${payment.amount}`);
      console.log(`   Status: ${payment.status}`);
      createdCount++;
    }

    // 3. Natijalarni ko'rsatish
    const pendingPayments = await Payment.find({
      isPaid: false,
      status: PaymentStatus.PENDING,
    });

    console.log("\n📊 Total PENDING payments:", pendingPayments.length);

    if (pendingPayments.length > 0) {
      console.log("\n📋 Sample payment:");
      console.log({
        id: pendingPayments[0]._id,
        customerId: pendingPayments[0].customerId,
        managerId: pendingPayments[0].managerId,
        amount: pendingPayments[0].amount,
        status: pendingPayments[0].status,
        isPaid: pendingPayments[0].isPaid,
      });
    }

    console.log("\n✅ Test completed successfully!");
    console.log("🎉 Now check the Kassa page - payments should appear!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

testPaymentCreation();
