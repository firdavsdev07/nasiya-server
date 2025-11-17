import Customer from "../../schemas/customer.schema";
import Contract from "../../schemas/contract.schema";
import Payment from "../../schemas/payment.schema";
import { Balance } from "../../schemas/balance.schema";
import { Expenses } from "../../schemas/expenses.schema";
import { Debtor } from "../../schemas/debtor.schema";
import Auth from "../../schemas/auth.schema";
import Notes from "../../schemas/notes.schema";
import Employee from "../../schemas/employee.schema";
import { RoleEnum } from "../../enums/role.enum";
import { checkAllContractsStatus } from "../../utils/checkAllContractsStatus";

class ResetService {
  /**
   * Barcha mijozlar, shartnomalar, to'lovlar va balanslarni tozalash
   * Faqat super admin va adminlar uchun
   */
  async resetAllData() {
    try {
      // 1. Barcha to'lovlarni o'chirish
      const deletedPayments = await Payment.deleteMany({});
      console.log(`✅ ${deletedPayments.deletedCount} ta to'lov o'chirildi`);

      // 2. Barcha shartnomalarni o'chirish
      const deletedContracts = await Contract.deleteMany({});
      console.log(
        `✅ ${deletedContracts.deletedCount} ta shartnoma o'chirildi`
      );

      // 3. Barcha qarzdorlarni o'chirish
      const deletedDebtors = await Debtor.deleteMany({});
      console.log(`✅ ${deletedDebtors.deletedCount} ta qarzdor o'chirildi`);

      // 4. Barcha xarajatlarni o'chirish
      const deletedExpenses = await Expenses.deleteMany({});
      console.log(`✅ ${deletedExpenses.deletedCount} ta xarajat o'chirildi`);

      // 5. Barcha mijozlarni o'chirish
      const customers = await Customer.find({}).select("auth");
      const customerAuthIds = customers.map((c) => c.auth);

      const deletedCustomers = await Customer.deleteMany({});
      console.log(`✅ ${deletedCustomers.deletedCount} ta mijoz o'chirildi`);

      // 6. Mijozlarning auth ma'lumotlarini o'chirish
      const deletedCustomerAuths = await Auth.deleteMany({
        _id: { $in: customerAuthIds },
      });
      console.log(
        `✅ ${deletedCustomerAuths.deletedCount} ta mijoz auth o'chirildi`
      );

      // 7. Mijozlarning notes ma'lumotlarini o'chirish (customer field orqali)
      const deletedNotes = await Notes.deleteMany({});
      console.log(`✅ ${deletedNotes.deletedCount} ta notes o'chirildi`);

      // 8. Barcha balanslarni 0 ga qaytarish (o'chirmaslik, faqat reset)
      const updatedBalances = await Balance.updateMany(
        {},
        { $set: { dollar: 0, sum: 0 } }
      );
      console.log(
        `✅ ${updatedBalances.modifiedCount} ta balans 0 ga qaytarildi`
      );

      return {
        success: true,
        message: "Barcha ma'lumotlar muvaffaqiyatli tozalandi",
        deletedCounts: {
          payments: deletedPayments.deletedCount,
          contracts: deletedContracts.deletedCount,
          debtors: deletedDebtors.deletedCount,
          expenses: deletedExpenses.deletedCount,
          customers: deletedCustomers.deletedCount,
          customerAuths: deletedCustomerAuths.deletedCount,
          notes: deletedNotes.deletedCount,
          balancesReset: updatedBalances.modifiedCount,
        },
      };
    } catch (error: any) {
      console.error("❌ Reset xatolik:", error);
      throw new Error(`Ma'lumotlarni tozalashda xatolik: ${error.message}`);
    }
  }

  /**
   * Reset qilish mumkinligini tekshirish
   */
  async canReset(userId: string) {
    try {
      // Development mode'da har kim reset qila oladi
      if (process.env.NODE_ENV === "development") {
        console.log("⚠️ Development mode - allowing reset for all users");
        return { canReset: true };
      }

      // Employee orqali role olish
      const employee = await Employee.findOne({ auth: userId }).populate(
        "role"
      );

      if (!employee) {
        console.log("❌ Employee not found for auth:", userId);
        return {
          canReset: false,
          reason:
            "Xodim topilmadi. Faqat admin va moderatorlar reset qila oladi.",
        };
      }

      const role = employee.role as any;
      console.log("👤 User role:", role?.name);

      const allowedRoles = [RoleEnum.ADMIN, RoleEnum.MODERATOR];

      if (!allowedRoles.includes(role?.name)) {
        return {
          canReset: false,
          reason: `Sizning rolingiz: ${role?.name}. Faqat admin va moderatorlar reset qila oladi.`,
        };
      }

      return { canReset: true };
    } catch (error: any) {
      console.error("❌ canReset error:", error);
      throw new Error(`Ruxsat tekshirishda xatolik: ${error.message}`);
    }
  }

  /**
   * Reset statistikasini olish (nechta yozuv bor)
   */
  async getResetStats() {
    try {
      const [
        customersCount,
        contractsCount,
        paymentsCount,
        debtorsCount,
        expensesCount,
        balances,
      ] = await Promise.all([
        Customer.countDocuments(),
        Contract.countDocuments(),
        Payment.countDocuments(),
        Debtor.countDocuments(),
        Expenses.countDocuments(),
        Balance.find({}).select("dollar sum"),
      ]);

      const totalBalance = balances.reduce(
        (acc, b) => ({
          dollar: acc.dollar + (b.dollar || 0),
          sum: acc.sum + (b.sum || 0),
        }),
        { dollar: 0, sum: 0 }
      );

      return {
        customers: customersCount,
        contracts: contractsCount,
        payments: paymentsCount,
        debtors: debtorsCount,
        expenses: expensesCount,
        totalBalance,
      };
    } catch (error: any) {
      throw new Error(`Statistika olishda xatolik: ${error.message}`);
    }
  }

  /**
   * Barcha shartnomalarning statusini tekshirish
   */
  async checkAllContractsStatus() {
    return await checkAllContractsStatus();
  }
}

export default new ResetService();
