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

      // ✅ actualAmount yoki amount ishlatish (haqiqatda to'langan summa)
      const totalPaid = (contract.payments as any[])
        .filter((p) => p.isPaid)
        .reduce((sum, p) => sum + (p.actualAmount || p.amount), 0);

      // ✅ Prepaid balance ham qo'shish
      const totalPaidWithPrepaid = totalPaid + (contract.prepaidBalance || 0);

      console.log("📊 Contract completion check:", {
        contractId,
        totalPaid,
        prepaidBalance: contract.prepaidBalance || 0,
        totalPaidWithPrepaid,
        totalPrice: contract.totalPrice,
        isComplete: totalPaidWithPrepaid >= contract.totalPrice,
        currentStatus: contract.status,
      });

      // ✅ Agar to'liq to'langan bo'lsa - COMPLETED
      if (totalPaidWithPrepaid >= contract.totalPrice) {
        if (contract.status !== ContractStatus.COMPLETED) {
          contract.status = ContractStatus.COMPLETED;
          await contract.save();
          console.log("✅ Contract status changed to COMPLETED:", contract._id);
        }
      } else {
        // ✅ Agar to'liq to'lanmagan bo'lsa va COMPLETED bo'lsa - ACTIVE ga qaytarish
        if (contract.status === ContractStatus.COMPLETED) {
          contract.status = ContractStatus.ACTIVE;
          await contract.save();
          console.log(
            "⚠️ Contract status changed back to ACTIVE:",
            contract._id
          );
        }
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
        console.log(
          `⚠️ UNDERPAID: ${remainingAmount.toFixed(2)} $ kam to'landi`
        );
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
        noteText += `\n✅ Ko'p to'landi: ${excessAmount.toFixed(
          2
        )} $ ortiqcha (keyingi oyga o'tkaziladi)`;
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
        contract.prepaidBalance =
          (contract.prepaidBalance || 0) + prepaidAmount;
        console.log(`💰 Prepaid balance updated: ${contract.prepaidBalance} $`);
      }

      await contract.save();
      console.log("✅ Payment added to contract");

      // ✅ Response'da to'lov holati haqida ma'lumot qaytarish
      let message = "To'lov muvaffaqiyatli qabul qilindi";
      if (paymentStatus === PaymentStatus.UNDERPAID) {
        message = `To'lov qabul qilindi, lekin ${remainingAmount.toFixed(
          2
        )} $ kam to'landi`;
      } else if (paymentStatus === PaymentStatus.OVERPAID) {
        message = `To'lov qabul qilindi, ${excessAmount.toFixed(
          2
        )} $ ortiqcha summa keyingi oyga o'tkazildi`;
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

      console.log("📦 Payment details:", {
        id: payment._id,
        amount: payment.amount,
        paymentType: payment.paymentType,
        isPaid: payment.isPaid,
        status: payment.status,
      });

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

      console.log("✅ Payment added to contract:", contract._id);

      // 4. nextPaymentDate ni keyingi oyga o'tkazish (faqat oylik to'lovlar uchun)
      console.log("🔍 Checking nextPaymentDate update conditions:", {
        hasNextPaymentDate: !!contract.nextPaymentDate,
        paymentType: payment.paymentType,
        isMonthly: payment.paymentType === PaymentType.MONTHLY,
        PaymentTypeEnum: PaymentType.MONTHLY,
      });

      if (
        contract.nextPaymentDate &&
        payment.paymentType === PaymentType.MONTHLY
      ) {
        const currentDate = new Date(contract.nextPaymentDate);

        // ✅ MUHIM: Agar to'lov kechiktirilgan bo'lsa (postponed), asl sanaga qaytarish
        let nextMonth: Date;

        if (contract.previousPaymentDate && contract.postponedAt) {
          // Kechiktirilgan to'lov to'landi - asl to'lov kuniga qaytarish
          const originalDay =
            contract.originalPaymentDay ||
            new Date(contract.previousPaymentDate).getDate();

          // Hozirgi oydan keyingi oyni hisoblash
          const today = new Date();
          nextMonth = new Date(
            today.getFullYear(),
            today.getMonth() + 1,
            originalDay
          );

          console.log(
            "🔄 Kechiktirilgan to'lov to'landi - asl sanaga qaytarildi:",
            {
              postponedDate: currentDate.toLocaleDateString("uz-UZ"),
              originalPaymentDay: originalDay,
              nextDate: nextMonth.toLocaleDateString("uz-UZ"),
            }
          );

          // Kechiktirilgan ma'lumotlarni tozalash
          contract.previousPaymentDate = undefined;
          contract.postponedAt = undefined;
        } else {
          // Oddiy to'lov - asl to'lov kuniga qaytarish
          const originalDay =
            contract.originalPaymentDay || currentDate.getDate();

          // Hozirgi oydan keyingi oyni hisoblash
          const today = new Date();
          nextMonth = new Date(
            today.getFullYear(),
            today.getMonth() + 1,
            originalDay
          );

          console.log("📅 Oddiy to'lov - asl to'lov kuniga o'tkazildi:", {
            old: currentDate.toLocaleDateString("uz-UZ"),
            originalPaymentDay: originalDay,
            new: nextMonth.toLocaleDateString("uz-UZ"),
          });
        }

        console.log("📅 BEFORE UPDATE:", {
          currentNextPaymentDate: contract.nextPaymentDate,
          currentNextPaymentDateISO: contract.nextPaymentDate.toISOString(),
          newNextPaymentDate: nextMonth,
          newNextPaymentDateISO: nextMonth.toISOString(),
        });

        contract.nextPaymentDate = nextMonth;

        console.log("📅 AFTER UPDATE (before save):", {
          nextPaymentDate: contract.nextPaymentDate,
          nextPaymentDateISO: contract.nextPaymentDate.toISOString(),
          previousPaymentDate: contract.previousPaymentDate,
        });
      } else {
        console.log(
          "⏭️ Skipping nextPaymentDate update - conditions not met:",
          {
            hasNextPaymentDate: !!contract.nextPaymentDate,
            paymentType: payment.paymentType,
            expectedType: PaymentType.MONTHLY,
          }
        );
      }

      // Contract'ni saqlash (payments va nextPaymentDate)
      await contract.save();
      console.log("💾 Contract saved with updated nextPaymentDate");

      // ✅ VERIFY: Database'dan qayta o'qib tekshirish
      const verifyContract = await Contract.findById(contract._id).select(
        "nextPaymentDate previousPaymentDate"
      );
      console.log("🔍 VERIFY - Database'dagi qiymat:", {
        nextPaymentDate: verifyContract?.nextPaymentDate,
        nextPaymentDateISO: verifyContract?.nextPaymentDate?.toISOString(),
        previousPaymentDate: verifyContract?.previousPaymentDate,
      });

      // 5. Balance yangilash (FAQAT BU YERDA - kassa tasdiqlanganda)
      await this.updateBalance(payment.managerId, {
        dollar: payment.amount,
        sum: 0,
      });

      console.log("💵 Balance updated for manager:", payment.managerId);

      // 6. Agar Debtor mavjud bo'lsa, o'chirish (kassa tasdiqlanganda)
      const deletedDebtors = await Debtor.deleteMany({
        contractId: contract._id,
      });

      if (deletedDebtors.deletedCount > 0) {
        console.log("🗑️ Debtor(s) deleted:", deletedDebtors.deletedCount);
      }

      // 7. Shartnoma to'liq to'langanini tekshirish
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

      // 3. ✅ YANGI: nextPaymentDate ni eski sanaga qaytarish
      // (Chunki botda to'lov qilinganda darhol yangilangan edi)
      if (payment.paymentType === PaymentType.MONTHLY) {
        const contract = await Contract.findOne({
          customer: payment.customerId,
          status: ContractStatus.ACTIVE,
        });

        if (contract && contract.nextPaymentDate) {
          const currentDate = new Date(contract.nextPaymentDate);
          const previousMonth = new Date(currentDate);
          previousMonth.setMonth(previousMonth.getMonth() - 1);

          contract.nextPaymentDate = previousMonth;
          await contract.save();

          console.log("🔙 nextPaymentDate rolled back:", {
            current: currentDate.toLocaleDateString("uz-UZ"),
            rolledBack: previousMonth.toLocaleDateString("uz-UZ"),
          });
        }
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
   * Qolgan qarzni to'lash (mavjud to'lovga qo'shimcha)
   * Mavjud UNDERPAID to'lovni PAID holatiga o'tkazish
   */
  async payRemaining(
    payData: {
      paymentId: string;
      amount: number;
      notes: string;
      currencyDetails: { dollar: number; sum: number };
      currencyCourse: number;
    },
    user: IJwtUser
  ) {
    try {
      console.log("💰 === PAY REMAINING (SERVICE) ===");
      console.log("Payment ID:", payData.paymentId);
      console.log("Amount:", payData.amount);

      // 1. Mavjud to'lovni topish
      const existingPayment = await Payment.findById(payData.paymentId);

      if (!existingPayment) {
        throw BaseError.NotFoundError("To'lov topilmadi");
      }

      console.log("✅ Existing payment found:", {
        id: existingPayment._id,
        status: existingPayment.status,
        remainingAmount: existingPayment.remainingAmount,
        actualAmount: existingPayment.actualAmount,
        expectedAmount: existingPayment.expectedAmount,
        isPaid: existingPayment.isPaid,
      });

      if (existingPayment.status !== PaymentStatus.UNDERPAID) {
        const statusMessages: Record<string, string> = {
          PAID: "Bu to'lov allaqachon to'liq to'langan",
          OVERPAID: "Bu to'lov ortiqcha to'langan",
          PENDING: "Bu to'lov hali tasdiqlanmagan",
        };

        const currentStatus = existingPayment.status || "UNKNOWN";
        const message =
          statusMessages[currentStatus] ||
          `Bu to'lov ${currentStatus} holatida. Faqat UNDERPAID (kam to'langan) to'lovlarni to'ldirish mumkin.`;
        throw BaseError.BadRequest(message);
      }

      if (
        !existingPayment.remainingAmount ||
        existingPayment.remainingAmount < 0.01
      ) {
        throw BaseError.BadRequest("Bu to'lovda qolgan qarz yo'q");
      }

      // 2. Manager topish
      const manager = await Employee.findById(user.sub);
      if (!manager) {
        throw BaseError.NotFoundError("Manager topilmadi");
      }

      // 3. Qolgan summani tekshirish
      const remainingAmount = existingPayment.remainingAmount || 0;
      const paymentAmount = payData.amount;

      if (paymentAmount > remainingAmount + 0.01) {
        throw BaseError.BadRequest(
          `Qolgan qarz ${remainingAmount} $, lekin siz ${paymentAmount} $ to'lamoqchisiz`
        );
      }

      // 4. actualAmount'ni yangilash
      const newActualAmount =
        (existingPayment.actualAmount || 0) + paymentAmount;
      const newRemainingAmount = Math.max(0, remainingAmount - paymentAmount);

      existingPayment.actualAmount = newActualAmount;
      existingPayment.remainingAmount = newRemainingAmount;

      // 5. Status'ni yangilash
      if (newRemainingAmount < 0.01) {
        existingPayment.status = PaymentStatus.PAID;
        existingPayment.isPaid = true;
        console.log("✅ Payment status changed to PAID");
      } else {
        console.log(`⚠️ Still UNDERPAID: ${newRemainingAmount} $ remaining`);
      }

      await existingPayment.save();

      // 6. Notes'ga qo'shish
      if (existingPayment.notes) {
        const notes = await Notes.findById(existingPayment.notes);
        if (notes) {
          notes.text += `\n\n💰 [${new Date().toLocaleDateString(
            "uz-UZ"
          )}] Qolgan qarz to'landi: ${paymentAmount} $`;
          if (payData.notes) {
            notes.text += `\nIzoh: ${payData.notes}`;
          }
          await notes.save();
        }
      }

      // 7. Balance yangilash
      await this.updateBalance(String(manager._id), {
        dollar: payData.currencyDetails.dollar || 0,
        sum: payData.currencyDetails.sum || 0,
      });
      console.log("✅ Balance updated");

      // 8. Agar to'liq to'langan bo'lsa, Debtor'ni o'chirish
      if (
        existingPayment.status === PaymentStatus.PAID &&
        existingPayment.isPaid
      ) {
        const contract = await Contract.findOne({
          payments: existingPayment._id,
        });

        if (contract) {
          // Debtor'ni o'chirish
          const deletedDebtors = await Debtor.deleteMany({
            contractId: contract._id,
          });
          if (deletedDebtors.deletedCount > 0) {
            console.log("🗑️ Debtor(s) deleted:", deletedDebtors.deletedCount);
          }

          // Contract completion tekshirish
          await this.checkContractCompletion(String(contract._id));
        }
      }

      console.log("✅ === PAY REMAINING COMPLETED ===");

      return {
        status: "success",
        message:
          newRemainingAmount < 0.01
            ? "Qolgan qarz to'liq to'landi"
            : `Qolgan qarz qisman to'landi. Hali ${newRemainingAmount.toFixed(
                2
              )} $ qoldi`,
        payment: {
          _id: existingPayment._id,
          actualAmount: existingPayment.actualAmount,
          remainingAmount: existingPayment.remainingAmount,
          status: existingPayment.status,
          isPaid: existingPayment.isPaid,
        },
      };
    } catch (error) {
      console.error("❌ Error in payRemaining:", error);
      throw error;
    }
  }

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
        console.log(
          `⚠️ UNDERPAID: ${remainingAmount.toFixed(2)} $ kam to'landi`
        );
      }
      // Ko'p to'langan (OVERPAID)
      else if (difference > 0.01) {
        paymentStatus = PaymentStatus.OVERPAID;
        excessAmount = difference;
        prepaidAmount = difference; // Keyingi oyga o'tkazish uchun
        console.log(`✅ OVERPAID: ${excessAmount.toFixed(2)} $ ko'p to'landi`);
      } else {
        console.log(`✓ EXACT PAYMENT: To'g'ri summa to'landi`);
      }

      // 1. Notes yaratish - to'lov holati haqida ma'lumot qo'shish
      let noteText = payData.notes || `To'lov: ${payData.amount} $`;

      if (paymentStatus === PaymentStatus.UNDERPAID) {
        noteText += `\n⚠️ Kam to'landi: ${remainingAmount.toFixed(2)} $ qoldi`;
      } else if (paymentStatus === PaymentStatus.OVERPAID) {
        noteText += `\n✅ Ko'p to'landi: ${excessAmount.toFixed(
          2
        )} $ ortiqcha (keyingi oyga o'tkaziladi)`;
      }

      const notes = await Notes.create({
        text: noteText,
        customer: contract.customer,
        createBy: String(manager._id),
      });

      const payment = await Payment.create({
        amount: expectedAmount, // ✅ Kutilgan summa (oylik to'lov)
        actualAmount: actualAmount, // ✅ Haqiqatda to'langan summa
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
        contract.prepaidBalance =
          (contract.prepaidBalance || 0) + prepaidAmount;
        console.log(`💰 Prepaid balance updated: ${contract.prepaidBalance} $`);
      }

      await contract.save();
      console.log("✅ Payment added to contract (Dashboard)");

      // ✅ Debtor o'chiriladi (agar mavjud bo'lsa va to'liq to'langan bo'lsa)
      if (
        paymentStatus === PaymentStatus.PAID ||
        paymentStatus === PaymentStatus.OVERPAID
      ) {
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
        message = `To'lov qabul qilindi, lekin ${remainingAmount.toFixed(
          2
        )} $ kam to'landi`;
      } else if (paymentStatus === PaymentStatus.OVERPAID) {
        message = `To'lov qabul qilindi, ${excessAmount.toFixed(
          2
        )} $ ortiqcha summa keyingi oyga o'tkazildi`;
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
        console.log(
          `⚠️ UNDERPAID: ${remainingAmount.toFixed(2)} $ kam to'landi`
        );
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
        noteText += `\n✅ Ko'p to'landi: ${excessAmount.toFixed(
          2
        )} $ ortiqcha (keyingi oyga o'tkaziladi)`;
      }

      const notes = await Notes.create({
        text: noteText,
        customer,
        createBy: String(manager._id),
      });

      // 2. Payment yaratish - to'lov holati bilan
      const paymentDoc = await Payment.create({
        amount: expectedAmount, // ✅ Kutilgan summa (oylik to'lov)
        actualAmount: actualAmount, // ✅ Haqiqatda to'langan summa
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
        contract.prepaidBalance =
          (contract.prepaidBalance || 0) + prepaidAmount;
        console.log(`💰 Prepaid balance updated: ${contract.prepaidBalance} $`);
      }

      await contract.save();
      console.log("✅ Payment added to contract (Dashboard)");

      // ✅ Debtor o'chiriladi (faqat to'liq to'langan bo'lsa)
      if (
        paymentStatus === PaymentStatus.PAID ||
        paymentStatus === PaymentStatus.OVERPAID
      ) {
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
        message = `To'lov qabul qilindi, lekin ${remainingAmount.toFixed(
          2
        )} $ kam to'landi`;
      } else if (paymentStatus === PaymentStatus.OVERPAID) {
        message = `To'lov qabul qilindi, ${excessAmount.toFixed(
          2
        )} $ ortiqcha summa keyingi oyga o'tkazildi`;
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

  /**
   * Barcha to'lanmagan oylar uchun to'lovlarni yaratish
   * Requirements: 8.1, 8.2, 8.3, 8.4
   */
  async payAllRemainingMonths(
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
      console.log("💰 === PAY ALL REMAINING MONTHS (DASHBOARD) ===");

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

      // 1. Barcha to'lovlarni olish
      const allPayments = await Payment.find({
        _id: { $in: contract.payments },
      }).sort({ date: 1 });

      // 2. To'langan oylik to'lovlar sonini hisoblash
      const paidMonthlyPayments = allPayments.filter(
        (p) => p.paymentType === PaymentType.MONTHLY && p.isPaid
      );

      const paidMonthsCount = paidMonthlyPayments.length;
      const totalMonths = contract.period;
      const remainingMonths = totalMonths - paidMonthsCount;

      console.log("📊 Payment analysis:", {
        totalMonths,
        paidMonthsCount,
        remainingMonths,
        monthlyPayment: contract.monthlyPayment,
      });

      if (remainingMonths <= 0) {
        throw BaseError.BadRequest("Barcha oylar allaqachon to'langan");
      }

      // 3. Har bir to'lanmagan oy uchun to'lov yaratish
      const createdPayments = [];
      const totalAmount = payData.amount;
      const perMonthAmount = totalAmount / remainingMonths;

      for (let i = 0; i < remainingMonths; i++) {
        const monthNumber = paidMonthsCount + i + 1;

        // Notes yaratish
        const noteText = `${monthNumber}-oy to'lovi: ${perMonthAmount.toFixed(
          2
        )} $ (Barchasini to'lash orqali)`;
        const notes = await Notes.create({
          text: noteText,
          customer: contract.customer,
          createBy: String(manager._id),
        });

        // Payment yaratish
        const payment = await Payment.create({
          amount: contract.monthlyPayment,
          actualAmount: perMonthAmount,
          date: new Date(),
          isPaid: true,
          paymentType: PaymentType.MONTHLY,
          customerId: contract.customer,
          managerId: String(manager._id),
          notes: notes._id,
          status: PaymentStatus.PAID,
          expectedAmount: contract.monthlyPayment,
          confirmedAt: new Date(),
          confirmedBy: user.sub,
        });

        createdPayments.push(payment);

        // Contract.payments ga qo'shish
        if (!contract.payments) {
          contract.payments = [];
        }
        (contract.payments as any[]).push(payment._id);

        console.log(
          `✅ Payment created for month ${monthNumber}:`,
          payment._id
        );
      }

      await contract.save();

      // 4. Balance yangilash
      await this.updateBalance(String(manager._id), {
        dollar: payData.currencyDetails.dollar || 0,
        sum: payData.currencyDetails.sum || 0,
      });
      console.log("✅ Balance updated");

      // 5. Debtor o'chirish
      const deletedDebtors = await Debtor.deleteMany({
        contractId: contract._id,
      });
      if (deletedDebtors.deletedCount > 0) {
        console.log("🗑️ Debtor(s) deleted:", deletedDebtors.deletedCount);
      }

      // 6. Contract completion tekshirish
      await this.checkContractCompletion(String(contract._id));

      return {
        status: "success",
        message: `${remainingMonths} oylik to'lovlar muvaffaqiyatli amalga oshirildi`,
        contractId: contract._id,
        paymentsCreated: createdPayments.length,
        totalAmount: totalAmount,
      };
    } catch (error) {
      console.error("❌ Error in payAllRemainingMonths:", error);
      throw error;
    }
  }
}

export default new PaymentService();
