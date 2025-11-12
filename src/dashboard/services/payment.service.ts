import Employee, { IEmployee } from "../../schemas/employee.schema";
import IJwtUser from "../../types/user";
import Payment, {
  PaymentStatus,
  PaymentType,
} from "../../schemas/payment.schema";
import { Debtor } from "../../schemas/debtor.schema";
import BaseError from "../../utils/base.error";
import Notes from "../../schemas/notes.schema";
import { Balance } from "../../schemas/balance.schema";
import Contract, { ContractStatus } from "../../schemas/contract.schema";
import { Types } from "mongoose";

interface PaymentDto {
  contractId: string;
  amount: number;
  notes?: string;
  currencyDetails: {
    dollar: number;
    sum: number;
  };
  currencyCourse: number;
}

class PaymentService {
  /**
   * Balance yangilash
   * Requirements: 2.2, 8.3
   */
  private async updateBalance(
    managerId: IEmployee | string,
    changes: {
      dollar?: number;
      sum?: number;
    }
  ) {
    try {
      let balance = await Balance.findOne({ managerId });

      if (!balance) {
        balance = await Balance.create({
          managerId,
          dollar: changes.dollar || 0,
          sum: changes.sum || 0,
        });
        console.log("✅ New balance created:", balance._id);
      } else {
        balance.dollar += changes.dollar || 0;
        balance.sum += changes.sum || 0;
        await balance.save();
        console.log("✅ Balance updated:", balance._id);
      }

      return balance;
    } catch (error) {
      console.error("❌ Error updating balance:", error);
      throw error;
    }
  }

  /**
   * Shartnoma to'liq to'langanini tekshirish
   * Requirements: 8.4
   */
  private async checkContractCompletion(contractId: string) {
    try {
      const contract = await Contract.findById(contractId).populate("payments");

      if (!contract) {
        return;
      }

      const totalPaid = (contract.payments as any[])
        .filter((p) => p.isPaid)
        .reduce((sum, p) => sum + p.amount, 0);

      console.log("📊 Contract completion check:", {
        contractId,
        totalPaid,
        totalPrice: contract.totalPrice,
        isComplete: totalPaid >= contract.totalPrice,
      });

      if (totalPaid >= contract.totalPrice) {
        contract.status = ContractStatus.COMPLETED;
        await contract.save();
        console.log("✅ Contract completed:", contract._id);
      }
    } catch (error) {
      console.error("❌ Error checking contract completion:", error);
      throw error;
    }
  }

  /**
   * To'lov qabul qilish (Manager tomonidan - Bot)
   * Requirements: 8.1
   * 
   * ✅ KAM yoki KO'P TO'LANGAN SUMMANI QAYD QILISH
   */
  async receivePayment(data: PaymentDto, user: IJwtUser) {
    try {
      console.log("💰 === RECEIVING PAYMENT (BOT) ===");
      console.log("Contract ID:", data.contractId);
      console.log("Amount:", data.amount);

      const contract = await Contract.findById(data.contractId);

      if (!contract) {
        throw BaseError.NotFoundError("Shartnoma topilmadi");
      }

      const manager = await Employee.findById(user.sub);

      if (!manager) {
        throw BaseError.NotFoundError("Manager topilmadi");
      }

      // ✅ TO'LOV TAHLILI - Kam yoki ko'p to'langanini aniqlash
      const expectedAmount = contract.monthlyPayment;
      const actualAmount = data.amount;
      const difference = actualAmount - expectedAmount;

      let paymentStatus = PaymentStatus.PAID;
      let remainingAmount = 0;
      let excessAmount = 0;
      let prepaidAmount = 0;

      // Kam to'langan (UNDERPAID)
      if (difference < -0.01) {
        paymentStatus = PaymentStatus.UNDERPAID;
        remainingAmount = Math.abs(difference);
        console.log(`⚠️ UNDERPAID: ${remainingAmount.toFixed(2)} $ kam to'landi`);
      }
      // Ko'p to'langan (OVERPAID)
      else if (difference > 0.01) {
        paymentStatus = PaymentStatus.OVERPAID;
        excessAmount = difference;
        prepaidAmount = difference;
        console.log(`✅ OVERPAID: ${excessAmount.toFixed(2)} $ ko'p to'landi`);
      }
      // To'g'ri to'langan (PAID)
      else {
        console.log(`✓ EXACT PAYMENT: To'g'ri summa to'landi`);
      }

      // 1. Notes yaratish - to'lov holati haqida ma'lumot qo'shish
      let noteText = data.notes || `To'lov: ${data.amount} $`;

      if (paymentStatus === PaymentStatus.UNDERPAID) {
        noteText += `\n⚠️ Kam to'landi: ${remainingAmount.toFixed(2)} $ qoldi`;
      } else if (paymentStatus === PaymentStatus.OVERPAID) {
        noteText += `\n✅ Ko'p to'landi: ${excessAmount.toFixed(2)} $ ortiqcha (keyingi oyga o'tkaziladi)`;
      }

      const notes = await Notes.create({
        text: noteText,
        customer: contract.customer,
        createBy: user.sub,
      });

      // 2. Payment yaratish - BOT TO'LOVI (PENDING - Kassa tasdiqlashi kerak)
      const payment = await Payment.create({
        amount: expectedAmount, // ✅ OYLIK TO'LOV
        actualAmount: actualAmount, // ✅ HAQIQATDA TO'LANGAN SUMMA
        date: new Date(),
        isPaid: false, // ❌ BOT TO'LOVI - Kassa tasdiqlashi kerak
        paymentType: PaymentType.MONTHLY,
        customerId: contract.customer,
        managerId: user.sub,
        notes: notes._id,
        status: PaymentStatus.PENDING, // ⏳ PENDING - Kassa tasdiqlashi kerak
        expectedAmount: expectedAmount, // Kutilgan summa
        remainingAmount: remainingAmount, // Kam to'langan summa
        excessAmount: excessAmount, // Ko'p to'langan summa
        prepaidAmount: prepaidAmount, // Keyingi oyga o'tkaziladigan summa
        // confirmedAt va confirmedBy - Kassa tasdiqlanganda qo'shiladi
      });

      console.log("✅ Payment created:", {
        id: payment._id,
        status: paymentStatus,
        amount: actualAmount,
        expected: expectedAmount,
        remaining: remainingAmount,
        excess: excessAmount,
      });

      // ❌ BOT TO'LOVI - Balance yangilanmasin (Kassa tasdiqlashi kerak)
      // Balance faqat kassa tasdiqlanganda yangilanadi (confirmPayment metodida)
      console.log("⏳ Balance NOT updated - waiting for cash confirmation");

      // ✅ Contract.payments ga qo'shish
      if (!contract.payments) {
        contract.payments = [];
      }
      (contract.payments as any[]).push(payment._id);

      // ✅ Contract'da prepaid balance'ni yangilash (ko'p to'langan bo'lsa)
      if (prepaidAmount > 0) {
        contract.prepaidBalance = (contract.prepaidBalance || 0) + prepaidAmount;
        console.log(`💰 Prepaid balance updated: ${contract.prepaidBalance} $`);
      }

      await contract.save();
      console.log("✅ Payment added to contract");

      // ✅ Response'da to'lov holati haqida ma'lumot qaytarish
      let message = "To'lov muvaffaqiyatli qabul qilindi";
      if (paymentStatus === PaymentStatus.UNDERPAID) {
        message = `To'lov qabul qilindi, lekin ${remainingAmount.toFixed(2)} $ kam to'landi`;
      } else if (paymentStatus === PaymentStatus.OVERPAID) {
        message = `To'lov qabul qilindi, ${excessAmount.toFixed(2)} $ ortiqcha summa keyingi oyga o'tkazildi`;
      }

      return {
        status: "success",
        message,
        paymentId: payment._id,
        paymentDetails: {
          status: paymentStatus,
          expectedAmount,
          actualAmount,
          remainingAmount,
          excessAmount,
          prepaidBalance: contract.prepaidBalance,
        },
      };
    } catch (error) {
      console.error("❌ Error receiving payment:", error);
      throw error;
    }
  }

  /**
   * To'lovni tasdiqlash (Kassa tomonidan)
   * Requirements: 8.2, 8.3, 8.4
   */
  async confirmPayment(paymentId: string, user: IJwtUser) {
    try {
      console.log("✅ === CONFIRMING PAYMENT ===");
      console.log("Payment ID:", paymentId);

      const payment = await Payment.findById(paymentId);

      if (!payment) {
        throw BaseError.NotFoundError("To'lov topilmadi");
      }

      if (payment.isPaid) {
        throw BaseError.BadRequest("To'lov allaqachon tasdiqlangan");
      }

      // 1. Payment'ni tasdiqlash
      payment.isPaid = true;
      payment.status = PaymentStatus.PAID;
      payment.confirmedAt = new Date();
      payment.confirmedBy = user.sub as any;
      await payment.save();

      console.log("✅ Payment confirmed:", payment._id);

      // 2. Contract'ni topish
      const contract = await Contract.findOne({
        customer: payment.customerId,
        status: ContractStatus.ACTIVE,
      });

      if (!contract) {
        throw BaseError.NotFoundError("Shartnoma topilmadi");
      }

      // 3. Contract.payments ga qo'shish
      if (!contract.payments) {
        contract.payments = [];
      }
      (contract.payments as string[]).push(payment._id.toString());
      await contract.save();

      console.log("✅ Payment added to contract:", contract._id);

      // 4. Balance yangilash (FAQAT BU YERDA - kassa tasdiqlanganda)
      // Payment yaratilganda currencyDetails saqlanmagan, shuning uchun amount'ni dollar sifatida qo'shamiz
      await this.updateBalance(payment.managerId, {
        dollar: payment.amount,
        sum: 0,
      });

      console.log("💵 Balance updated for manager:", payment.managerId);

      // 5. Agar Debtor mavjud bo'lsa, o'chirish (kassa tasdiqlanganda)
      const deletedDebtors = await Debtor.deleteMany({
        contractId: contract._id,
      });

      if (deletedDebtors.deletedCount > 0) {
        console.log("🗑️ Debtor(s) deleted:", deletedDebtors.deletedCount);
      }

      // 6. Shartnoma to'liq to'langanini tekshirish
      await this.checkContractCompletion(String(contract._id));

      return {
        status: "success",
        message: "To'lov tasdiqlandi",
        paymentId: payment._id,
        contractId: contract._id,
      };
    } catch (error) {
      console.error("❌ Error confirming payment:", error);
      throw error;
    }
  }

  /**
   * To'lovni rad etish (Kassa tomonidan)
   * Requirements: 8.5
   */
  async rejectPayment(paymentId: string, reason: string, user: IJwtUser) {
    try {
      console.log("❌ === REJECTING PAYMENT ===");
      console.log("Payment ID:", paymentId);
      console.log("Reason:", reason);

      const payment = await Payment.findById(paymentId).populate("notes");

      if (!payment) {
        throw BaseError.NotFoundError("To'lov topilmadi");
      }

      if (payment.isPaid) {
        throw BaseError.BadRequest("Tasdiqlangan to'lovni rad etib bo'lmaydi");
      }

      // 1. Payment status'ni o'zgartirish
      payment.status = PaymentStatus.REJECTED;
      await payment.save();

      // 2. Notes'ga rad etish sababini qo'shish
      if (payment.notes) {
        payment.notes.text += `\n[RAD ETILDI: ${reason}]`;
        await payment.notes.save();
      }

      console.log("✅ Payment rejected:", payment._id);

      return {
        status: "success",
        message: "To'lov rad etildi",
        paymentId: payment._id,
      };
    } catch (error) {
      console.error("❌ Error rejecting payment:", error);
      throw error;
    }
  }

  /**
   * To'lovlar tarixini olish
   * Requirements: 7.1, 7.2
   */
  async getPaymentHistory(customerId?: string, contractId?: string) {
    try {
      console.log("📜 Getting payment history for:", {
        customerId,
        contractId,
      });

      let matchCondition: any = { isPaid: true };

      if (customerId) {
        matchCondition.customerId = new Types.ObjectId(customerId);
      }

      if (contractId) {
        const contract = await Contract.findById(contractId);
        if (contract) {
          matchCondition.customerId = new Types.ObjectId(
            contract.customer.toString()
          );
        }
      }

      const payments = await Payment.aggregate([
        { $match: matchCondition },
        {
          $lookup: {
            from: "customers",
            localField: "customerId",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },
        {
          $lookup: {
            from: "employees",
            localField: "managerId",
            foreignField: "_id",
            as: "manager",
          },
        },
        { $unwind: "$manager" },
        {
          $lookup: {
            from: "notes",
            localField: "notes",
            foreignField: "_id",
            as: "notes",
          },
        },
        {
          $addFields: {
            customerName: {
              $concat: [
                "$customer.firstName",
                " ",
                { $ifNull: ["$customer.lastName", ""] },
              ],
            },
            managerName: {
              $concat: [
                "$manager.firstName",
                " ",
                { $ifNull: ["$manager.lastName", ""] },
              ],
            },
            notes: { $ifNull: [{ $arrayElemAt: ["$notes.text", 0] }, ""] },
          },
        },
        {
          $project: {
            _id: 1,
            amount: 1,
            date: 1,
            paymentType: 1,
            customerName: 1,
            managerName: 1,
            notes: 1,
            status: 1,
          },
        },
        { $sort: { date: -1 } },
      ]);

      console.log("✅ Found payments:", payments.length);

      return {
        status: "success",
        data: payments,
      };
    } catch (error) {
      console.error("❌ Error getting payment history:", error);
      throw BaseError.InternalServerError("To'lovlar tarixini olishda xatolik");
    }
  }

  /**
   * Shartnoma bo'yicha to'lov qilish (Dashboard - PAID darhol)
   * Requirements: 8.1, 8.2, 8.3, 8.4
   * 
   * ✅ KAM yoki KO'P TO'LANGAN SUMMANI QAYD QILISH
   */
  async payByContract(
    payData: {
      contractId: string;
      amount: number;
      notes?: string;
      currencyDetails: { dollar: number; sum: number };
      currencyCourse: number;
    },
    user: IJwtUser
  ) {
    try {
      console.log("💰 === PAY BY CONTRACT (DASHBOARD - PAID) ===");

      const contract = await Contract.findById(payData.contractId).populate(
        "customer"
      );

      if (!contract) {
        throw BaseError.NotFoundError("Shartnoma topilmadi");
      }

      const manager = await Employee.findById(user.sub);

      if (!manager) {
        throw BaseError.NotFoundError("Manager topilmadi");
      }

      // ✅ TO'LOV TAHLILI - Kam yoki ko'p to'langanini aniqlash
      const expectedAmount = contract.monthlyPayment;
      const actualAmount = payData.amount;
      const difference = actualAmount - expectedAmount;

      let paymentStatus = PaymentStatus.PAID;
      let remainingAmount = 0;
      let excessAmount = 0;
      let prepaidAmount = 0;

      // Kam to'langan (UNDERPAID)
      if (difference < -0.01) {
        paymentStatus = PaymentStatus.UNDERPAID;
        remainingAmount = Math.abs(difference);
        console.log(`⚠️ UNDERPAID: ${remainingAmount.toFixed(2)} $ kam to'landi`);
      }
      // Ko'p to'langan (OVERPAID)
      else if (difference > 0.01) {
        paymentStatus = PaymentStatus.OVERPAID;
        excessAmount = difference;
        prepaidAmount = difference; // Keyingi oyga o'tkazish uchun
        console.log(`✅ OVERPAID: ${excessAmount.toFixed(2)} $ ko'p to'landi`);
      }
      // To'g'ri to'langan (PAID)
      else {
        console.log(`✓ EXACT PAYMENT: To'g'ri summa to'landi`);
      }

      // 1. Notes yaratish - to'lov holati haqida ma'lumot qo'shish
      let noteText = payData.notes || `To'lov: ${payData.amount} $`;

      if (paymentStatus === PaymentStatus.UNDERPAID) {
        noteText += `\n⚠️ Kam to'landi: ${remainingAmount.toFixed(2)} $ qoldi`;
      } else if (paymentStatus === PaymentStatus.OVERPAID) {
        noteText += `\n✅ Ko'p to'landi: ${excessAmount.toFixed(2)} $ ortiqcha (keyingi oyga o'tkaziladi)`;
      }

      const notes = await Notes.create({
        text: noteText,
        customer: contract.customer,
        createBy: String(manager._id),
      });

      // 2. Payment yaratish - to'lov holati bilan
      const payment = await Payment.create({
        amount: actualAmount,
        date: new Date(),
        isPaid: true, // ✅ Dashboard darhol tasdiqlaydi
        paymentType: PaymentType.MONTHLY,
        customerId: contract.customer,
        managerId: String(manager._id),
        notes: notes._id,
        status: paymentStatus, // ✅ PAID / UNDERPAID / OVERPAID
        expectedAmount: expectedAmount, // Kutilgan summa
        remainingAmount: remainingAmount, // Kam to'langan summa
        excessAmount: excessAmount, // Ko'p to'langan summa
        prepaidAmount: prepaidAmount, // Keyingi oyga o'tkaziladigan summa
        confirmedAt: new Date(),
        confirmedBy: user.sub,
      });

      console.log("✅ Payment created:", {
        id: payment._id,
        status: paymentStatus,
        amount: actualAmount,
        expected: expectedAmount,
        remaining: remainingAmount,
        excess: excessAmount,
      });

      // ✅ Balance darhol yangilanadi (Dashboard)
      await this.updateBalance(String(manager._id), {
        dollar: payData.currencyDetails.dollar || 0,
        sum: payData.currencyDetails.sum || 0,
      });
      console.log("✅ Balance updated (Dashboard)");

      // ✅ Contract.payments ga darhol qo'shiladi
      if (!contract.payments) {
        contract.payments = [];
      }
      (contract.payments as any[]).push(payment._id);

      // ✅ Contract'da prepaid balance'ni yangilash (ko'p to'langan bo'lsa)
      if (prepaidAmount > 0) {
        contract.prepaidBalance = (contract.prepaidBalance || 0) + prepaidAmount;
        console.log(`💰 Prepaid balance updated: ${contract.prepaidBalance} $`);
      }

      await contract.save();
      console.log("✅ Payment added to contract (Dashboard)");

      // ✅ Debtor o'chiriladi (agar mavjud bo'lsa va to'liq to'langan bo'lsa)
      if (paymentStatus === PaymentStatus.PAID || paymentStatus === PaymentStatus.OVERPAID) {
        const deletedDebtors = await Debtor.deleteMany({
          contractId: contract._id,
        });
        if (deletedDebtors.deletedCount > 0) {
          console.log("🗑️ Debtor(s) deleted:", deletedDebtors.deletedCount);
        }
      }

      // ✅ Contract completion tekshirish
      await this.checkContractCompletion(String(contract._id));

      // ✅ Response'da to'lov holati haqida ma'lumot qaytarish
      let message = "To'lov muvaffaqiyatli qabul qilindi";
      if (paymentStatus === PaymentStatus.UNDERPAID) {
        message = `To'lov qabul qilindi, lekin ${remainingAmount.toFixed(2)} $ kam to'landi`;
      } else if (paymentStatus === PaymentStatus.OVERPAID) {
        message = `To'lov qabul qilindi, ${excessAmount.toFixed(2)} $ ortiqcha summa keyingi oyga o'tkazildi`;
      }

      return {
        status: "success",
        message,
        contractId: contract._id,
        paymentId: payment._id,
        paymentDetails: {
          status: paymentStatus,
          expectedAmount,
          actualAmount,
          remainingAmount,
          excessAmount,
          prepaidBalance: contract.prepaidBalance,
        },
      };
    } catch (error) {
      console.error("❌ Error in payByContract:", error);
      throw error;
    }
  }

  /**
   * Debtor bo'yicha to'lov qilish (Dashboard - PAID darhol)
   * Requirements: 8.1, 8.2, 8.3, 8.4
   * 
   * ✅ KAM yoki KO'P TO'LANGAN SUMMANI QAYD QILISH
   */
  async update(
    payData: {
      id: string;
      amount: number;
      notes?: string;
      currencyDetails: { dollar: number; sum: number };
      currencyCourse: number;
    },
    user: IJwtUser
  ) {
    try {
      console.log("💰 === DEBTOR PAYMENT (DASHBOARD - PAID) ===");

      const existingDebtor = await Debtor.findById(payData.id).populate(
        "contractId"
      );

      if (!existingDebtor) {
        throw BaseError.NotFoundError("Qarizdorlik topilmadi yoki o'chirilgan");
      }

      const customer = existingDebtor.contractId.customer;
      const manager = await Employee.findById(user.sub);

      if (!manager) {
        throw BaseError.NotFoundError("Manager topilmadi yoki o'chirilgan");
      }

      const contract = await Contract.findById(existingDebtor.contractId._id);

      if (!contract) {
        throw BaseError.NotFoundError("Shartnoma topilmadi");
      }

      // ✅ TO'LOV TAHLILI - Kam yoki ko'p to'langanini aniqlash
      const expectedAmount = contract.monthlyPayment;
      const actualAmount = payData.amount;
      const difference = actualAmount - expectedAmount;

      let paymentStatus = PaymentStatus.PAID;
      let remainingAmount = 0;
      let excessAmount = 0;
      let prepaidAmount = 0;

      // Kam to'langan (UNDERPAID)
      if (difference < -0.01) {
        paymentStatus = PaymentStatus.UNDERPAID;
        remainingAmount = Math.abs(difference);
        console.log(`⚠️ UNDERPAID: ${remainingAmount.toFixed(2)} $ kam to'landi`);
      }
      // Ko'p to'langan (OVERPAID)
      else if (difference > 0.01) {
        paymentStatus = PaymentStatus.OVERPAID;
        excessAmount = difference;
        prepaidAmount = difference;
        console.log(`✅ OVERPAID: ${excessAmount.toFixed(2)} $ ko'p to'landi`);
      }
      // To'g'ri to'langan (PAID)
      else {
        console.log(`✓ EXACT PAYMENT: To'g'ri summa to'landi`);
      }

      // 1. Notes yaratish - to'lov holati haqida ma'lumot qo'shish
      let noteText = payData.notes || `To'lov: ${payData.amount} $`;

      if (paymentStatus === PaymentStatus.UNDERPAID) {
        noteText += `\n⚠️ Kam to'landi: ${remainingAmount.toFixed(2)} $ qoldi`;
      } else if (paymentStatus === PaymentStatus.OVERPAID) {
        noteText += `\n✅ Ko'p to'landi: ${excessAmount.toFixed(2)} $ ortiqcha (keyingi oyga o'tkaziladi)`;
      }

      const notes = await Notes.create({
        text: noteText,
        customer,
        createBy: String(manager._id),
      });

      // 2. Payment yaratish - to'lov holati bilan
      const paymentDoc = await Payment.create({
        amount: actualAmount,
        date: new Date(),
        isPaid: true, // ✅ Dashboard darhol tasdiqlaydi
        paymentType: PaymentType.MONTHLY,
        customerId: customer,
        managerId: String(manager._id),
        notes: notes._id,
        status: paymentStatus, // ✅ PAID / UNDERPAID / OVERPAID
        expectedAmount: expectedAmount, // Kutilgan summa
        remainingAmount: remainingAmount, // Kam to'langan summa
        excessAmount: excessAmount, // Ko'p to'langan summa
        prepaidAmount: prepaidAmount, // Keyingi oyga o'tkaziladigan summa
        confirmedAt: new Date(),
        confirmedBy: user.sub,
      });

      console.log("✅ Payment created:", {
        id: paymentDoc._id,
        status: paymentStatus,
        amount: actualAmount,
        expected: expectedAmount,
        remaining: remainingAmount,
        excess: excessAmount,
      });

      // ✅ Balance darhol yangilanadi (Dashboard)
      await this.updateBalance(String(manager._id), {
        dollar: payData.currencyDetails.dollar || 0,
        sum: payData.currencyDetails.sum || 0,
      });
      console.log("✅ Balance updated (Dashboard)");

      // ✅ Contract.payments ga darhol qo'shiladi
      if (!contract.payments) {
        contract.payments = [];
      }
      (contract.payments as any[]).push(paymentDoc._id);

      // ✅ Contract'da prepaid balance'ni yangilash (ko'p to'langan bo'lsa)
      if (prepaidAmount > 0) {
        contract.prepaidBalance = (contract.prepaidBalance || 0) + prepaidAmount;
        console.log(`💰 Prepaid balance updated: ${contract.prepaidBalance} $`);
      }

      await contract.save();
      console.log("✅ Payment added to contract (Dashboard)");

      // ✅ Debtor o'chiriladi (faqat to'liq to'langan bo'lsa)
      if (paymentStatus === PaymentStatus.PAID || paymentStatus === PaymentStatus.OVERPAID) {
        await Debtor.findByIdAndDelete(payData.id);
        console.log("🗑️ Debtor deleted");
      } else {
        console.log("⚠️ Debtor NOT deleted - payment is underpaid");
      }

      // ✅ Contract completion tekshirish
      await this.checkContractCompletion(String(contract._id));

      // ✅ Response'da to'lov holati haqida ma'lumot qaytarish
      let message = "To'lov muvaffaqiyatli qabul qilindi";
      if (paymentStatus === PaymentStatus.UNDERPAID) {
        message = `To'lov qabul qilindi, lekin ${remainingAmount.toFixed(2)} $ kam to'landi`;
      } else if (paymentStatus === PaymentStatus.OVERPAID) {
        message = `To'lov qabul qilindi, ${excessAmount.toFixed(2)} $ ortiqcha summa keyingi oyga o'tkazildi`;
      }

      return {
        status: "success",
        message,
        paymentId: paymentDoc._id,
        paymentDetails: {
          status: paymentStatus,
          expectedAmount,
          actualAmount,
          remainingAmount,
          excessAmount,
          prepaidBalance: contract.prepaidBalance,
        },
      };
    } catch (error) {
      console.error("❌ Error in debtor payment:", error);
      throw error;
    }
  }
}

export default new PaymentService();
