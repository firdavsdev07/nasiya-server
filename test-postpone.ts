import mongoose from "mongoose";
import "dotenv/config";
import connectDB from "./src/config/db";
import Contract from "./src/schemas/contract.schema";

async function testPostpone() {
    try {
        await connectDB();
        console.log("✅ Database connected");

        // Birinchi active shartnomani topish
        const contract = await Contract.findOne({ status: "active" });

        if (!contract) {
            console.log("❌ Active shartnoma topilmadi");
            process.exit(1);
        }

        console.log("\n📋 Shartnoma topildi:");
        console.log("   - ID:", contract._id);
        console.log("   - Product:", contract.productName);
        console.log("   - Next Payment Date:", contract.nextPaymentDate);
        console.log("   - Previous Payment Date:", contract.previousPaymentDate);
        console.log("   - Postponed At:", contract.postponedAt);

        // Test: previousPaymentDate o'rnatish
        const oldDate = contract.nextPaymentDate;
        const newDate = new Date();
        newDate.setDate(newDate.getDate() + 10); // 10 kun keyinga

        contract.previousPaymentDate = oldDate;
        contract.nextPaymentDate = newDate;
        contract.postponedAt = new Date();

        await contract.save();

        console.log("\n✅ Shartnoma yangilandi:");
        console.log("   - Previous Payment Date:", contract.previousPaymentDate);
        console.log("   - Next Payment Date:", contract.nextPaymentDate);
        console.log("   - Postponed At:", contract.postponedAt);

        // Qayta o'qish
        const updatedContract = await Contract.findById(contract._id);
        console.log("\n🔍 Database'dan qayta o'qildi:");
        console.log("   - Previous Payment Date:", updatedContract?.previousPaymentDate);
        console.log("   - Next Payment Date:", updatedContract?.nextPaymentDate);
        console.log("   - Postponed At:", updatedContract?.postponedAt);

        process.exit(0);
    } catch (error) {
        console.error("❌ Xatolik:", error);
        process.exit(1);
    }
}

testPostpone();
