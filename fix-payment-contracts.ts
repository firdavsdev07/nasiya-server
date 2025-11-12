/**
 * Payment'larni Contract'larga bog'lash script
 * 
 * Bu script barcha payment'larni tekshiradi va agar payment
 * contract.payments array'ida bo'lmasa, qo'shadi.
 */

import "dotenv/config";
import connectDB from "./src/config/db";
import Payment from "./src/schemas/payment.schema";
import Contract from "./src/schemas/contract.schema";

async function fixPaymentContracts() {
    try {
        console.log("🔧 === FIXING PAYMENT-CONTRACT LINKS ===");

        await connectDB();

        // 1. Barcha payment'larni olish
        const payments = await Payment.find({})
            .select("_id customerId date")
            .lean();

        console.log(`📊 Total payments: ${payments.length}`);

        let fixedCount = 0;
        let alreadyLinkedCount = 0;
        let notFoundCount = 0;

        // 2. Har bir payment uchun contract topish
        for (const payment of payments) {
            try {
                // Payment allaqachon contract'ga bog'langanmi?
                const existingContract = await Contract.findOne({
                    payments: payment._id,
                });

                if (existingContract) {
                    alreadyLinkedCount++;
                    continue;
                }

                // Contract topish (customer va date bo'yicha)
                const contract = await Contract.findOne({
                    customer: payment.customerId,
                    startDate: { $lte: payment.date },
                    endDate: { $gte: payment.date },
                });

                if (contract) {
                    // Payment'ni contract'ga qo'shish
                    await Contract.updateOne(
                        { _id: contract._id },
                        { $addToSet: { payments: payment._id } }
                    );

                    console.log(`✅ Fixed: Payment ${payment._id} -> Contract ${contract._id}`);
                    fixedCount++;
                } else {
                    console.warn(`⚠️ Contract not found for payment ${payment._id}`);
                    notFoundCount++;
                }
            } catch (error) {
                console.error(`❌ Error processing payment ${payment._id}:`, error);
            }
        }

        console.log("\n🎉 === FIXING COMPLETED ===");
        console.log(`✅ Fixed: ${fixedCount}`);
        console.log(`✅ Already linked: ${alreadyLinkedCount}`);
        console.log(`⚠️ Not found: ${notFoundCount}`);
        console.log(`📊 Total: ${payments.length}`);

        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}

fixPaymentContracts();
