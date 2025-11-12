import mongoose from "mongoose";
import "dotenv/config";
import connectDB from "./src/config/db";
import Contract from "./src/schemas/contract.schema";
import customerService from "./src/bot/services/customer.service";

async function testAPI() {
    try {
        await connectDB();
        console.log("✅ Database connected");

        // Birinchi active shartnomani topish
        const contract = await Contract.findOne({ status: "active" }).populate("customer");

        if (!contract) {
            console.log("❌ Active shartnoma topilmadi");
            process.exit(1);
        }

        const customerId = (contract.customer as any)._id.toString();
        console.log("\n📋 Customer ID:", customerId);

        // API orqali olish
        const result = await customerService.getCustomerContracts(customerId);

        console.log("\n✅ API Response:");
        console.log(JSON.stringify(result, null, 2));

        // previousPaymentDate borligini tekshirish
        const allContracts = result.data.allContracts;
        const debtorContracts = result.data.debtorContracts;

        console.log("\n🔍 All Contracts:");
        allContracts.forEach((c: any) => {
            console.log(`   - ${c.productName}:`);
            console.log(`     nextPaymentDate: ${c.nextPaymentDate}`);
            console.log(`     previousPaymentDate: ${c.previousPaymentDate}`);
            console.log(`     postponedAt: ${c.postponedAt}`);
        });

        console.log("\n🔍 Debtor Contracts:");
        debtorContracts.forEach((c: any) => {
            console.log(`   - ${c.productName}:`);
            console.log(`     nextPaymentDate: ${c.nextPaymentDate}`);
            console.log(`     previousPaymentDate: ${c.previousPaymentDate}`);
            console.log(`     postponedAt: ${c.postponedAt}`);
        });

        process.exit(0);
    } catch (error) {
        console.error("❌ Xatolik:", error);
        process.exit(1);
    }
}

testAPI();
