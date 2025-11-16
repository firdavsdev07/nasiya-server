import "dotenv/config";
import connectDB from "../src/config/db";
import Customer from "../src/schemas/customer.schema";
import Contract from "../src/schemas/contract.schema";
import Payment from "../src/schemas/payment.schema";
import Notes from "../src/schemas/notes.schema";
import Employee from "../src/schemas/employee.schema";
import { Debtor } from "../src/schemas/debtor.schema";
import { Types } from "mongoose";

/**
 * Test ma'lumotlar yaratish skripti
 * Bu skript Qarzdorlar va To'lovlar sahifalarini to'ldirish uchun test ma'lumotlar yaratadi
 */

async function generateTestData() {
    try {
        console.log("🚀 Test ma'lumotlar yaratish boshlandi...\n");

        await connectDB();

        // 1. Manager topish (birinchi manager)
        const manager = await Employee.findOne({ role: { $exists: true } });
        if (!manager) {
            console.error("❌ Manager topilmadi! Avval admin yarating.");
            process.exit(1);
        }
        console.log(`✅ Manager topildi: ${manager.firstName} ${manager.lastName}`);

        // 2. Test mijozlar yaratish
        console.log("\n📝 Mijozlar yaratilmoqda...");

        const testCustomers = [
            {
                firstName: "Ali",
                lastName: "Valiyev",
                phoneNumber: "+998901234567",
                passportSeries: "AA1234567",
                address: "Toshkent, Chilonzor",
                birthDate: new Date("1990-01-15"),
                manager: manager._id,
                isActive: true,
                isDeleted: false,
                isVerified: true,
            },
            {
                firstName: "Bobur",
                lastName: "Karimov",
                phoneNumber: "+998902345678",
                passportSeries: "AB2345678",
                address: "Toshkent, Yunusobod",
                birthDate: new Date("1985-05-20"),
                manager: manager._id,
                isActive: true,
                isDeleted: false,
                isVerified: true,
            },
            {
                firstName: "Dilshod",
                lastName: "Rahimov",
                phoneNumber: "+998903456789",
                passportSeries: "AC3456789",
                address: "Toshkent, Sergeli",
                birthDate: new Date("1992-08-10"),
                manager: manager._id,
                isActive: true,
                isDeleted: false,
                isVerified: true,
            },
            {
                firstName: "Eldor",
                lastName: "Tursunov",
                phoneNumber: "+998904567890",
                passportSeries: "AD4567890",
                address: "Toshkent, Mirzo Ulugbek",
                birthDate: new Date("1988-03-25"),
                manager: manager._id,
                isActive: true,
                isDeleted: false,
                isVerified: true,
            },
            {
                firstName: "Farrux",
                lastName: "Aliyev",
                phoneNumber: "+998905678901",
                passportSeries: "AE5678901",
                address: "Toshkent, Yakkasaroy",
                birthDate: new Date("1995-11-30"),
                manager: manager._id,
                isActive: true,
                isDeleted: false,
                isVerified: true,
            },
        ];

        const createdCustomers = [];
        for (const customerData of testCustomers) {
            const existing = await Customer.findOne({ phoneNumber: customerData.phoneNumber });
            if (existing) {
                console.log(`⚠️  Mijoz mavjud: ${customerData.firstName} ${customerData.lastName}`);
                createdCustomers.push(existing);
            } else {
                const customer = await Customer.create(customerData);
                console.log(`✅ Mijoz yaratildi: ${customer.firstName} ${customer.lastName}`);
                createdCustomers.push(customer);
            }
        }

        // 3. Shartnomalar va to'lovlar yaratish
        console.log("\n📋 Shartnomalar yaratilmoqda...");

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < createdCustomers.length; i++) {
            const customer = createdCustomers[i];

            // Notes yaratish
            const notes = await Notes.create({
                text: `Test shartnoma - ${customer.firstName}`,
                createdBy: manager._id,
            });

            // Har bir mijoz uchun 1-2 ta shartnoma
            const contractsCount = i % 2 === 0 ? 2 : 1;

            for (let j = 0; j < contractsCount; j++) {
                const productName = j === 0 ? "iPhone 15 Pro Max" : "MacBook Pro M3";
                const originalPrice = j === 0 ? 1200 : 2500;
                const initialPayment = j === 0 ? 300 : 500;
                const period = j === 0 ? 12 : 18;
                const monthlyPayment = Math.round((originalPrice - initialPayment) / period);
                const totalPrice = originalPrice;

                // Shartnoma boshlanish sanasi (1-3 oy oldin)
                const startDate = new Date(today);
                startDate.setMonth(startDate.getMonth() - (i + 1));
                startDate.setHours(0, 0, 0, 0);

                // Keyingi to'lov sanasi
                let nextPaymentDate = new Date(startDate);
                nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

                // Ba'zi shartnomalarni kechikkan qilish (qarzdorlar uchun)
                const isOverdue = i < 3; // Birinchi 3 ta mijoz qarzdor
                if (isOverdue) {
                    nextPaymentDate.setDate(nextPaymentDate.getDate() - (10 + i * 5)); // 10-25 kun kechikkan
                }

                const contract = await Contract.create({
                    customer: customer._id,
                    productName,
                    originalPrice,
                    price: originalPrice,
                    initialPayment,
                    period,
                    monthlyPayment,
                    totalPrice,
                    startDate,
                    nextPaymentDate,
                    originalPaymentDay: startDate.getDate(),
                    status: "active",
                    notes: notes._id,
                    isDeclare: false,
                    isActive: true,
                    isDeleted: false,
                    payments: [],
                });

                console.log(`  ✅ Shartnoma: ${productName} - ${customer.firstName}`);

                // To'lovlar yaratish
                const payments = [];

                // Boshlang'ich to'lov
                const initialPaymentDoc = await Payment.create({
                    contractId: contract._id,
                    customerId: customer._id,
                    amount: initialPayment,
                    actualAmount: initialPayment,
                    expectedAmount: initialPayment,
                    date: startDate,
                    isPaid: true,
                    status: "PAID",
                    paymentType: "initial",
                    managerId: manager._id,
                });
                payments.push(initialPaymentDoc._id);

                // Oylik to'lovlar (ba'zilari to'langan, ba'zilari to'lanmagan)
                const paidMonths = isOverdue ? Math.floor(period / 3) : Math.floor(period / 2);

                for (let month = 0; month < period; month++) {
                    const paymentDate = new Date(startDate);
                    paymentDate.setMonth(paymentDate.getMonth() + month + 1);

                    const isPaid = month < paidMonths;

                    const monthlyPaymentDoc = await Payment.create({
                        contractId: contract._id,
                        customerId: customer._id,
                        amount: monthlyPayment,
                        actualAmount: isPaid ? monthlyPayment : 0,
                        expectedAmount: monthlyPayment,
                        date: paymentDate,
                        isPaid: isPaid,
                        status: isPaid ? "PAID" : "PENDING",
                        paymentType: "monthly",
                        managerId: manager._id,
                    });
                    payments.push(monthlyPaymentDoc._id);
                }

                // Shartnomaga to'lovlarni bog'lash
                contract.payments = payments;
                await contract.save();

                // Agar kechikkan bo'lsa, Debtor yaratish
                if (isOverdue) {
                    const overdueDays = Math.floor((today.getTime() - nextPaymentDate.getTime()) / (1000 * 60 * 60 * 24));

                    await Debtor.create({
                        contractId: contract._id,
                        debtAmount: monthlyPayment,
                        dueDate: nextPaymentDate,
                        overdueDays: overdueDays,
                        createBy: manager._id,
                    });

                    console.log(`    🔴 Qarzdor yaratildi: ${overdueDays} kun kechikkan`);
                }
            }
        }

        console.log("\n✅ Test ma'lumotlar muvaffaqiyatli yaratildi!");
        console.log("\n📊 Yaratilgan ma'lumotlar:");
        console.log(`   - Mijozlar: ${createdCustomers.length}`);
        console.log(`   - Shartnomalar: ${await Contract.countDocuments()}`);
        console.log(`   - To'lovlar: ${await Payment.countDocuments()}`);
        console.log(`   - Qarzdorlar: ${await Debtor.countDocuments()}`);

        process.exit(0);
    } catch (error) {
        console.error("❌ Xatolik:", error);
        process.exit(1);
    }
}

generateTestData();
