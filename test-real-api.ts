import "dotenv/config";
import connectDB from "./src/config/db";
import customerController from "./src/bot/controllers/customer.controller";

async function testRealAPI() {
    try {
        await connectDB();
        console.log("✅ Database connected");

        // Mock request va response
        const req = {
            params: { id: "6911b9fdd8114cefd1b9fd87" },
            user: { sub: "someUserId" }
        } as any;

        const res = {
            json: (data: any) => {/*  */
                console.log("\n✅ REAL API RESPONSE:");
                console.log(JSON.stringify(data, null, 2));

                // previousPaymentDate tekshirish
                if (data.data) {
                    console.log("\n🔍 CHECKING previousPaymentDate:");

                    if (data.data.allContracts) {
                        console.log("ALL CONTRACTS:");
                        data.data.allContracts.forEach((c: any) => {
                            console.log(`  - ${c.productName}:`, {
                                previousPaymentDate: c.previousPaymentDate,
                                exists: !!c.previousPaymentDate,
                            });
                        });
                    }

                    if (data.data.debtorContracts) {
                        console.log("DEBTOR CONTRACTS:");
                        data.data.debtorContracts.forEach((c: any) => {
                            console.log(`  - ${c.productName}:`, {
                                previousPaymentDate: c.previousPaymentDate,
                                exists: !!c.previousPaymentDate,
                            });
                        });
                    }
                }

                process.exit(0);
            },
            status: (code: number) => ({ json: (data: any) => console.log(data) })
        } as any;

        const next = (err: any) => {
            console.error("❌ Error:", err);
            process.exit(1);
        };

        await customerController.getCustomerContracts(req, res, next);
    } catch (error) {
        console.error("❌ Xatolik:", error);
        process.exit(1);
    }
}

testRealAPI();
