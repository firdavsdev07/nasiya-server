import Contract, { ContractStatus } from "../schemas/contract.schema";

/**
 * Barcha shartnomalarning statusini tekshirish va yangilash
 * To'lovlar to'liq to'langan shartnomalarni COMPLETED ga o'tkazish
 */
export async function checkAllContractsStatus() {
  try {
    console.log("🔍 Checking all contracts status...");

    const contracts = await Contract.find({
      isDeleted: false,
      isActive: true,
    }).populate("payments");

    let updatedCount = 0;
    let completedCount = 0;
    let activeCount = 0;

    for (const contract of contracts) {
      const payments = contract.payments as any[];

      // ✅ actualAmount yoki amount ishlatish (haqiqatda to'langan summa)
      const totalPaid = payments
        .filter((p) => p.isPaid)
        .reduce((sum, p) => sum + (p.actualAmount || p.amount), 0);

      // ✅ Prepaid balance ham qo'shish
      const totalPaidWithPrepaid = totalPaid + (contract.prepaidBalance || 0);

      const shouldBeCompleted = totalPaidWithPrepaid >= contract.totalPrice;
      const currentStatus = contract.status;

      // ✅ Status yangilash kerakmi?
      if (shouldBeCompleted && currentStatus !== ContractStatus.COMPLETED) {
        contract.status = ContractStatus.COMPLETED;
        await contract.save();
        updatedCount++;
        completedCount++;
        console.log(`✅ Contract ${contract._id} -> COMPLETED`);
      } else if (
        !shouldBeCompleted &&
        currentStatus === ContractStatus.COMPLETED
      ) {
        contract.status = ContractStatus.ACTIVE;
        await contract.save();
        updatedCount++;
        activeCount++;
        console.log(`⚠️ Contract ${contract._id} -> ACTIVE`);
      }
    }

    console.log("✅ Contract status check completed:", {
      totalContracts: contracts.length,
      updatedCount,
      completedCount,
      activeCount,
    });

    return {
      success: true,
      totalContracts: contracts.length,
      updatedCount,
      completedCount,
      activeCount,
    };
  } catch (error: any) {
    console.error("❌ Error checking contracts status:", error);
    throw new Error(`Contract status check failed: ${error.message}`);
  }
}
