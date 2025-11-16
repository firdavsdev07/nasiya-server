import "dotenv/config";
import connectDB from "../src/config/db";
import Customer from "../src/schemas/customer.schema";
import Contract from "../src/schemas/contract.schema";
import Payment from "../src/schemas/payment.schema";
import Notes from "../src/schemas/notes.schema";
import { Debtor } from "../src/schemas/debtor.schema";

/**
 * Barcha test ma'lumotlarni o'chirish skripti
 */

async function cleanTestData() {
    try {
        console.log("🧹 Test ma'lumotlarni tozalash boshlandi...\n");

        await connectDB();

        // Test telefon raqamlari
        const testPhoneNumbers = [
            "+998901234567",
            "+998902345678",
            "+998903456789",
            "+998904567890",
            "+998905678901",
        ];

        // Test mijozlarni topish
        const testCustomers = await Customer.find({
            phoneNumber: { $in: testPhoneNumbers },
        });

        console.log(`📋 Topilgan test mijozlar: ${testCustomers.length}`);

        if (testCustomers.length === 0) {
            console.log("✅ Test ma'lumotlar topilmadi.");
            process.exit(0);
        }

        const customerIds = testCustomers.map((c) => c._id);

        // Shartnomalarni topish
        const contracts = await Contract.find({ customer: { $in: customerIds } });
        const contractIds = contracts.map((c) => c._id);
        console.log(`📋 Topilgan shartnomalar: ${contracts.length}`);

        // Notes'larni topish
        const notesIds = contracts.map((c) => c.notes).filter((n) => n);

        // O'chirish
        console.log("\n🗑️  O'chirilmoqda...");

        const debtorsDeleted = await Debtor.deleteMany({
            contractId: { $in: contractIds },
        });
        console.log(`  ✅ Qarzdorlar o'chirildi: ${debtorsDeleted.deletedCount}`);

        const paymentsDeleted = await Payment.deleteMany({
            contractId: { $in: contractIds },
        });
        console.log(`  ✅ To'lovlar o'chirildi: ${paymentsDeleted.deletedCount}`);

        const contractsDeleted = await Contract.deleteMany({
            _id: { $in: contractIds },
        });
        console.log(`  ✅ Shartnomalar o'chirildi: ${contractsDeleted.deletedCount}`);

        const notesDeleted = await Notes.deleteMany({ _id: { $in: notesIds } });
        console.log(`  ✅ Notes o'chirildi: ${notesDeleted.deletedCount}`);

        const customersDeleted = await Customer.deleteMany({
            _id: { $in: customerIds },
        });
        console.log(`  ✅ Mijozlar o'chirildi: ${customersDeleted.deletedCount}`);

        console.log("\n✅ Barcha test ma'lumotlar tozalandi!");

        process.exit(0);
    } catch (error) {
        console.error("❌ Xatolik:", error);
        process.exit(1);
    }
}

cleanTestData();
