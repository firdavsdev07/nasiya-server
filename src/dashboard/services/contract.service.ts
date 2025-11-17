import BaseError from "../../utils/base.error";
import Contract, { ContractStatus } from "../../schemas/contract.schema";
import {
  CreateContractDto,
  UpdateContractDto,
} from "../../validators/contract";
import IJwtUser from "../../types/user";
import Employee from "../../schemas/employee.schema";
import Notes from "../../schemas/notes.schema";
import { Types } from "mongoose";
import Customer from "../../schemas/customer.schema";
import Payment, {
  PaymentStatus,
  PaymentType,
  PaymentReason,
} from "../../schemas/payment.schema";
import { Balance } from "../../schemas/balance.schema";
import { Debtor } from "../../schemas/debtor.schema";
import {
  verifyContractEditPermission,
  validateContractEditInput,
  createAuditLog,
  checkRateLimit,
  sanitizeContractForLogging,
} from "./contract.service.security";

class ContractService {
  // ========================================
  // HELPER METHODS
  // ========================================

  /**
   * Initial payment yaratish
   * Requirements: 1.2, 4.1, 4.4
   * ✅ YANGI: Boshlang'ich to'lov tasdiqlangan holda yaratiladi va kassada ko'rinadi (audit uchun)
   */
  private async createInitialPayment(
    contract: any,
    amount: number,
    user: IJwtUser
  ) {
    try {
      console.log("💰 Creating initial payment:", amount);

      // 1. Notes yaratish
      const notes = new Notes({
        text: `Boshlang'ich to'lov: ${amount}`,
        customer: contract.customer,
        createBy: user.sub,
      });
      await notes.save();

      // 2. Payment yaratish (isPaid: true, status: PAID - avtomatik tasdiqlangan)
      const payment = new Payment({
        amount,
        date: contract.startDate,
        isPaid: true, // ✅ Avtomatik tasdiqlangan
        paymentType: PaymentType.INITIAL,
        customerId: contract.customer,
        managerId: user.sub,
        notes: notes._id,
        status: PaymentStatus.PAID, // ✅ PAID status
        confirmedAt: new Date(),
        confirmedBy: user.sub,
      });
      await payment.save();

      // 3. Contract.payments arrayga qo'shish
      if (!contract.payments) {
        contract.payments = [];
      }
      contract.payments.push(payment._id);
      await contract.save();

      console.log("✅ Initial payment created (PAID):", payment._id);
      console.log("📊 Payment will be visible in cash page for audit");

      return payment;
    } catch (error) {
      console.error("❌ Error creating initial payment:", error);
      throw error;
    }
  }

  /**
   * Balance yangilash
   * Requirements: 2.1, 2.3
   */
  private async updateBalance(
    managerId: any,
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

  // Removed unused methods: updateInitialPayment and recalculatePayments
  // These methods are no longer used in the optimized flow

  /**
   * Contract status'ni qayta tekshirish
   */
  private async recheckContractStatus(contractId: string) {
    try {
      const contract = await Contract.findById(contractId).populate("payments");
      if (!contract) return;

      // ✅ actualAmount yoki amount ishlatish (haqiqatda to'langan summa)
      const totalPaid = (contract.payments as any[])
        .filter((p: any) => p.isPaid)
        .reduce((sum: number, p: any) => sum + (p.actualAmount || p.amount), 0);

      // ✅ Prepaid balance ham qo'shish
      const totalPaidWithPrepaid = totalPaid + (contract.prepaidBalance || 0);

      console.log("📊 Contract status check:", {
        contractId,
        totalPaid,
        prepaidBalance: contract.prepaidBalance || 0,
        totalPaidWithPrepaid,
        totalPrice: contract.totalPrice,
        currentStatus: contract.status,
        shouldBeCompleted: totalPaidWithPrepaid >= contract.totalPrice,
      });

      // ✅ Agar to'liq to'langan bo'lsa - COMPLETED
      if (totalPaidWithPrepaid >= contract.totalPrice) {
        if (contract.status !== ContractStatus.COMPLETED) {
          contract.status = ContractStatus.COMPLETED;
          await contract.save();
          console.log("✅ Contract status changed to COMPLETED");
        }
      } else {
        // ✅ Agar to'liq to'lanmagan bo'lsa va COMPLETED bo'lsa - ACTIVE ga qaytarish
        if (contract.status === ContractStatus.COMPLETED) {
          contract.status = ContractStatus.ACTIVE;
          await contract.save();
          console.log("✅ Contract status changed to ACTIVE");
        }
      }
    } catch (error) {
      console.error("❌ Error rechecking contract status:", error);
      throw error;
    }
  }

  /**
   * Shartnoma tahrirlashni validatsiya qilish
   * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
   */
  private async validateContractEdit(
    contract: any,
    changes: Array<{
      field: string;
      oldValue: any;
      newValue: any;
      difference: number;
    }>
  ): Promise<void> {
    console.log("🔍 Validating contract edit...");

    for (const change of changes) {
      // 1. Manfiy qiymatlarni tekshirish (Requirement 9.1)
      if (change.newValue < 0) {
        throw BaseError.BadRequest(
          `${change.field} manfiy bo'lishi mumkin emas`
        );
      }

      // 2. Maksimal o'zgarishni tekshirish - 50% (Requirement 9.2)
      // FAQAT monthlyPayment uchun 50% cheklovi
      if (change.field === "monthlyPayment") {
        // Agar eski qiymat 0 bo'lsa, bu yangi qiymat qo'shish, validatsiya kerak emas
        if (change.oldValue > 0 && change.newValue > 0) {
          const changePercent = Math.abs(
            (change.difference / change.oldValue) * 100
          );

          console.log(
            "📊 Monthly Payment Change Percent:",
            changePercent.toFixed(2) + "%"
          );

          if (changePercent > 50) {
            throw BaseError.BadRequest(
              `Oylik to'lovni 50% dan ko'p o'zgartirish mumkin emas. ` +
                `Hozirgi o'zgarish: ${changePercent.toFixed(1)}%\n` +
                `Eski qiymat: ${change.oldValue}, Yangi qiymat: ${change.newValue}, Farq: ${change.difference}`
            );
          }
        }
      }

      // initialPayment uchun cheklov yo'q - istalgancha o'zgartirish mumkin
      // Chunki bu boshlang'ich to'lov va mijoz bilan kelishilgan holda o'zgartirilishi mumkin

      // 3. Total price > initial payment tekshirish (Requirement 9.3)
      if (change.field === "totalPrice" || change.field === "initialPayment") {
        const totalPrice =
          change.field === "totalPrice" ? change.newValue : contract.totalPrice;
        const initialPayment =
          change.field === "initialPayment"
            ? change.newValue
            : contract.initialPayment;

        if (totalPrice <= initialPayment) {
          throw BaseError.BadRequest(
            "Umumiy narx boshlang'ich to'lovdan katta bo'lishi kerak"
          );
        }
      }
    }

    // 4. Completed shartnomalarni tahrirlashni tekshirish (Requirement 9.4, 9.5)
    if (contract.status === ContractStatus.COMPLETED) {
      console.log("⚠️ Warning: Editing completed contract");
      // UI'da tasdiqlash so'raladi - bu yerda faqat ogohlantirish
      // Agar kerak bo'lsa, qo'shimcha tekshiruvlar qo'shilishi mumkin
    }

    console.log("✅ Validation passed");
  }

  /**
   * Ta'sir tahlili - shartnoma tahrirlashning ta'sirini hisoblash
   * Requirements: 1.2, 1.3, 1.4, 1.5
   */
  private async analyzeEditImpact(
    contract: any,
    changes: Array<{
      field: string;
      oldValue: any;
      newValue: any;
      difference: number;
    }>
  ): Promise<{
    underpaidCount: number;
    overpaidCount: number;
    totalShortage: number;
    totalExcess: number;
    additionalPaymentsCreated: number;
  }> {
    console.log("📊 Analyzing edit impact...");

    const impact = {
      underpaidCount: 0,
      overpaidCount: 0,
      totalShortage: 0,
      totalExcess: 0,
      additionalPaymentsCreated: 0,
    };

    // Faqat monthly payment o'zgarishi uchun tahlil qilish
    const monthlyPaymentChange = changes.find(
      (c) => c.field === "monthlyPayment"
    );

    if (!monthlyPaymentChange) {
      console.log("ℹ️ No monthly payment change detected");
      return impact;
    }

    // Barcha to'langan oylik to'lovlarni topish
    const paidMonthlyPayments = await Payment.find({
      _id: { $in: contract.payments },
      paymentType: PaymentType.MONTHLY,
      isPaid: true,
    }).sort({ date: 1 });

    if (paidMonthlyPayments.length === 0) {
      console.log("ℹ️ No paid monthly payments found");
      return impact;
    }

    console.log(`📋 Found ${paidMonthlyPayments.length} paid monthly payments`);

    // Har bir to'lov uchun diff hisoblash
    for (const payment of paidMonthlyPayments) {
      const diff = payment.amount - monthlyPaymentChange.newValue;

      if (diff < -0.01) {
        // UNDERPAID - to'langan summa yangi oylik to'lovdan kam
        const shortage = Math.abs(diff);
        impact.underpaidCount++;
        impact.totalShortage += shortage;
        impact.additionalPaymentsCreated++;

        console.log(
          `⚠️ Payment ${payment._id}: UNDERPAID by ${shortage.toFixed(2)}`
        );
      } else if (diff > 0.01) {
        // OVERPAID - to'langan summa yangi oylik to'lovdan ko'p
        const excess = diff;
        impact.overpaidCount++;
        impact.totalExcess += excess;

        console.log(
          `✅ Payment ${payment._id}: OVERPAID by ${excess.toFixed(2)}`
        );
      } else {
        // EXACT MATCH - to'g'ri to'langan
        console.log(`✓ Payment ${payment._id}: Exact match`);
      }
    }

    console.log("✅ Impact analysis completed:", {
      underpaidCount: impact.underpaidCount,
      overpaidCount: impact.overpaidCount,
      totalShortage: impact.totalShortage.toFixed(2),
      totalExcess: impact.totalExcess.toFixed(2),
      additionalPaymentsCreated: impact.additionalPaymentsCreated,
    });

    return impact;
  }

  /**
   * Qo'shimcha to'lov yaratish (UNDERPAID holat uchun)
   * Requirements: 2.3, 2.4, 2.5, 2.6, 2.7
   */
  private async createAdditionalPayment(
    contract: any,
    originalPayment: any,
    amount: number,
    paymentMonth: string
  ): Promise<any> {
    console.log(
      `💰 Creating additional payment: ${amount} for ${paymentMonth}`
    );

    try {
      // 1. Notes yaratish
      const notes = await Notes.create({
        text: `Qo'shimcha to'lov: ${paymentMonth} oyi uchun oylik to'lov o'zgarishi tufayli ${amount.toFixed(
          2
        )} yetishmayapti.\n\nAsosiy to'lov: ${
          originalPayment.amount
        }\nYangi oylik to'lov: ${
          originalPayment.expectedAmount
        }\nYetishmayapti: ${amount.toFixed(2)}`,
        customer: contract.customer,
        createBy: originalPayment.managerId,
      });

      // 2. Qo'shimcha to'lov yaratish
      const additionalPayment = await Payment.create({
        amount: amount,
        date: new Date(),
        isPaid: false,
        paymentType: PaymentType.EXTRA,
        customerId: contract.customer,
        managerId: originalPayment.managerId,
        notes: notes._id,
        status: PaymentStatus.PENDING,
        expectedAmount: amount,
        linkedPaymentId: originalPayment._id,
        reason: "monthly_payment_increase",
      });

      // 3. Contract.payments ga qo'shish
      contract.payments.push(additionalPayment._id);
      await contract.save();

      console.log(`✅ Additional payment created: ${additionalPayment._id}`);

      return additionalPayment;
    } catch (error) {
      console.error("❌ Error creating additional payment:", error);
      throw error;
    }
  }

  /**
   * Boshlang'ich to'lov o'zgarishini boshqarish
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 5.1, 5.2, 5.3
   */
  private async handleInitialPaymentChange(
    contract: any,
    diff: number,
    user: IJwtUser
  ): Promise<Types.ObjectId | null> {
    console.log(`💰 Initial payment changed by: ${diff}`);

    try {
      // 1. Initial payment'ni topish (Requirement 6.1)
      const initialPayment = await Payment.findOne({
        _id: { $in: contract.payments },
        paymentType: PaymentType.INITIAL,
      }).populate("notes");

      if (!initialPayment) {
        console.log("⚠️ No initial payment found");
        return null;
      }

      // 2. Payment amount'ni yangilash (Requirement 6.2)
      const oldAmount = initialPayment.amount;
      initialPayment.amount += diff;

      // 3. Notes yangilash (Requirement 6.4)
      initialPayment.notes.text += `\n\n📝 [${new Date().toLocaleDateString(
        "uz-UZ"
      )}] Boshlang'ich to'lov o'zgartirildi: ${oldAmount} → ${
        initialPayment.amount
      }`;
      initialPayment.reason = PaymentReason.INITIAL_PAYMENT_CHANGE;

      await initialPayment.save();
      await initialPayment.notes.save();

      console.log(
        `✅ Initial payment updated: ${oldAmount} → ${initialPayment.amount}`
      );

      // 4. Balance'ni yangilash (Requirement 6.3)
      const customer = await Customer.findById(contract.customer).populate(
        "manager"
      );
      if (customer && customer.manager) {
        await this.updateBalance(customer.manager._id, {
          dollar: diff,
          sum: 0,
        });

        console.log(
          `💵 Balance updated for manager: ${customer.manager._id}, diff: ${diff}`
        );
      }

      return initialPayment._id;
    } catch (error) {
      console.error("❌ Error handling initial payment change:", error);
      throw error;
    }
  }

  /**
   * Umumiy narx o'zgarishini boshqarish
   * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
   */
  private async handleTotalPriceChange(
    contract: any,
    newTotalPrice: number
  ): Promise<void> {
    console.log(
      `📊 Total price changed: ${contract.totalPrice} → ${newTotalPrice}`
    );

    try {
      // 1. Contract.totalPrice yangilash (Requirement 7.1)
      const oldTotalPrice = contract.totalPrice;
      contract.totalPrice = newTotalPrice;

      // 2. Contract status'ni qayta tekshirish (Requirement 7.2, 7.3, 7.4)
      await this.recheckContractStatus(String(contract._id));

      // 3. Status o'zgarishini log qilish
      console.log(`✅ Total price change handled successfully`);
      console.log(`   Old total price: ${oldTotalPrice}`);
      console.log(`   New total price: ${newTotalPrice}`);
      console.log(`   Contract status: ${contract.status}`);
    } catch (error) {
      console.error("❌ Error handling total price change:", error);
      throw error;
    }
  }

  /**
   * Debtor'larni yangilash (OPTIMIZED - Batch Update)
   * Requirements: 11.1, 11.2, 11.3, 11.4
   *
   * OPTIMIZATION: Use updateMany instead of loop for better performance
   */
  private async handleDebtorUpdate(
    contractId: Types.ObjectId,
    oldMonthlyPayment: number,
    newMonthlyPayment: number
  ): Promise<void> {
    console.log("📋 === UPDATING DEBTORS (OPTIMIZED) ===");
    console.log(`Contract ID: ${contractId}`);
    console.log(`Old monthly payment: ${oldMonthlyPayment}`);
    console.log(`New monthly payment: ${newMonthlyPayment}`);

    try {
      // OPTIMIZATION: Batch update all debtors in single query
      const result = await Debtor.updateMany(
        { contractId },
        {
          $set: {
            debtAmount: newMonthlyPayment,
          },
        }
      );

      console.log(`✅ Batch updated ${result.modifiedCount} debtor(s)`);
      console.log("✅ === DEBTOR UPDATE COMPLETED ===");
    } catch (error) {
      console.error("❌ Error updating debtors:", error);
      throw error;
    }
  }

  /**
   * Oylik to'lov o'zgarishini boshqarish
   * Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3
   */
  private async handleMonthlyPaymentChange(
    contract: any,
    oldAmount: number,
    newAmount: number
  ): Promise<Types.ObjectId[]> {
    console.log(`📅 Monthly payment changed: ${oldAmount} → ${newAmount}`);

    const affectedPayments: Types.ObjectId[] = [];

    // 1. Barcha to'langan oylik to'lovlarni topish
    const paidMonthlyPayments = await Payment.find({
      _id: { $in: contract.payments },
      paymentType: PaymentType.MONTHLY,
      isPaid: true,
    })
      .sort({ date: 1 })
      .populate("notes");

    if (paidMonthlyPayments.length === 0) {
      console.log("ℹ️ No paid monthly payments found");
      return affectedPayments;
    }

    console.log(
      `📋 Processing ${paidMonthlyPayments.length} paid monthly payments`
    );

    let cumulativeExcess = 0; // Jami ortiqcha summa (kaskad logika uchun)

    // 2. Har bir to'lovni qayta hisoblash
    for (let i = 0; i < paidMonthlyPayments.length; i++) {
      const payment = paidMonthlyPayments[i];
      const originalAmount = payment.amount;

      // Oldingi oydan o'tgan summani hisobga olish (kaskad logika)
      const effectiveExpected = newAmount - cumulativeExcess;
      const diff = originalAmount - effectiveExpected;

      // expectedAmount yangilash
      payment.expectedAmount = newAmount;
      affectedPayments.push(payment._id);

      if (Math.abs(diff) < 0.01) {
        // TO'G'RI TO'LANGAN (PAID)
        payment.status = PaymentStatus.PAID;
        payment.remainingAmount = 0;
        payment.excessAmount = 0;
        cumulativeExcess = 0;

        console.log(`✅ Payment ${i + 1}: PAID (exact match)`);
      } else if (diff < 0) {
        // KAM TO'LANGAN (UNDERPAID)
        const shortage = Math.abs(diff);
        payment.status = PaymentStatus.UNDERPAID;
        payment.remainingAmount = shortage;
        payment.excessAmount = 0;

        // Notes yangilash
        const paymentDate = new Date(payment.date).toLocaleDateString("uz-UZ", {
          year: "numeric",
          month: "long",
        });
        payment.notes.text += `\n\n⚠️ [${new Date().toLocaleDateString(
          "uz-UZ"
        )}] Oylik to'lov o'zgartirildi: ${oldAmount} → ${newAmount}. ${shortage.toFixed(
          2
        )} yetishmayapti.`;
        await payment.notes.save();

        // Qo'shimcha to'lov yaratish
        const additionalPayment = await this.createAdditionalPayment(
          contract,
          payment,
          shortage,
          paymentDate
        );

        affectedPayments.push(additionalPayment._id);
        cumulativeExcess = 0;

        console.log(
          `⚠️ Payment ${i + 1}: UNDERPAID (shortage: ${shortage.toFixed(2)})`
        );
      } else {
        // KO'P TO'LANGAN (OVERPAID)
        const excess = diff;
        payment.status = PaymentStatus.OVERPAID;
        payment.excessAmount = excess;
        payment.remainingAmount = 0;

        // Notes yangilash
        const nextMonth = new Date(payment.date);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const nextMonthName = nextMonth.toLocaleDateString("uz-UZ", {
          month: "long",
        });

        payment.notes.text += `\n\n✅ [${new Date().toLocaleDateString(
          "uz-UZ"
        )}] Oylik to'lov o'zgartirildi: ${oldAmount} → ${newAmount}. ${excess.toFixed(
          2
        )} ${nextMonthName} oyiga o'tkazildi.`;
        await payment.notes.save();

        // Keyingi oyga o'tkazish (kaskad logika)
        cumulativeExcess += excess;

        console.log(
          `✅ Payment ${i + 1}: OVERPAID (excess: ${excess.toFixed(
            2
          )}, cumulative: ${cumulativeExcess.toFixed(2)})`
        );
      }

      await payment.save();
    }

    // 3. Agar oxirida ortiqcha summa qolsa, prepaidBalance ga qo'shish
    if (cumulativeExcess > 0) {
      contract.prepaidBalance =
        (contract.prepaidBalance || 0) + cumulativeExcess;
      await contract.save();

      console.log(
        `💰 Prepaid balance updated: ${contract.prepaidBalance.toFixed(2)}`
      );
    }

    // 4. Barcha Debtor'larni yangilash (Requirements: 11.1, 11.2, 11.3, 11.4)
    await this.handleDebtorUpdate(contract._id, oldAmount, newAmount);

    console.log("✅ Monthly payment change handled successfully");

    return affectedPayments;
  }

  // ========================================
  // MAIN METHODS
  // ========================================

  async getAll() {
    return await Contract.aggregate([
      {
        $match: {
          isDeleted: false,
          isActive: true,
          status: ContractStatus.ACTIVE,
        },
      },
      {
        $lookup: {
          from: "notes",
          localField: "notes",
          foreignField: "_id",
          as: "notes",
          pipeline: [{ $project: { text: 1 } }],
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "customer",
          foreignField: "_id",
          as: "customer",
          pipeline: [
            {
              $project: {
                firstName: 1,
                lastName: 1,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "payments",
          localField: "payments",
          foreignField: "_id",
          as: "payments",
        },
      },
      {
        $addFields: {
          notes: { $ifNull: [{ $arrayElemAt: ["$notes.text", 0] }, null] },
          customer: {
            $cond: [
              { $gt: [{ $size: "$customer" }, 0] },
              { $toString: { $arrayElemAt: ["$customer._id", 0] } },
              null,
            ],
          },
          customerName: {
            $cond: [
              { $gt: [{ $size: "$customer" }, 0] },
              {
                $concat: [
                  {
                    $dateToString: {
                      format: "%d",
                      date: "$startDate",
                    },
                  },
                  " ",
                  { $arrayElemAt: ["$customer.firstName", 0] },
                  " ",
                  {
                    $ifNull: [{ $arrayElemAt: ["$customer.lastName", 0] }, ""],
                  },
                ],
              },
              null,
            ],
          },
          totalPaid: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$payments",
                    as: "p",
                    cond: { $eq: ["$$p.isPaid", true] },
                  },
                },
                as: "pp",
                in: {
                  $cond: [
                    { $ifNull: ["$$pp.actualAmount", false] },
                    "$$pp.actualAmount",
                    "$$pp.amount",
                  ],
                },
              },
            },
          },
        },
      },
      {
        $addFields: {
          remainingDebt: {
            $subtract: ["$totalPrice", "$totalPaid"],
          },
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
    ]);
  }

  async getAllNewContract() {
    return await Contract.aggregate([
      {
        $match: {
          isDeleted: false,
          isActive: false,
          status: ContractStatus.ACTIVE,
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "customer",
          foreignField: "_id",
          as: "customer",
          pipeline: [
            {
              $lookup: {
                from: "employees",
                localField: "manager",
                foreignField: "_id",
                as: "manager",
              },
            },
            { $unwind: { path: "$manager", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                firstName: 1,
                lastName: 1,
                percent: 1,
                passportSeries: 1,
                phoneNumber: 1,
                birthDate: 1,
                telegramName: 1,
                isActive: 1,
                address: 1,
                _id: 1,
                isDeleted: 1,
                "manager.firstName": 1,
                "manager.lastName": 1,
                "manager._id": 1,
              },
            },
          ],
        },
      },
      { $unwind: "$customer" },
      {
        $lookup: {
          from: "notes",
          localField: "notes",
          foreignField: "_id",
          as: "notes",
          pipeline: [{ $project: { text: 1 } }],
        },
      },
      {
        $lookup: {
          from: "employees",
          localField: "createBy",
          foreignField: "_id",
          as: "seller",
          pipeline: [
            {
              $project: {
                firstName: 1,
                lastName: 1,
              },
            },
          ],
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
          sellerName: {
            $cond: [
              { $gt: [{ $size: "$seller" }, 0] },
              {
                $concat: [
                  { $arrayElemAt: ["$seller.firstName", 0] },
                  " ",
                  {
                    $ifNull: [{ $arrayElemAt: ["$seller.lastName", 0] }, ""],
                  },
                ],
              },
              "N/A",
            ],
          },
          notes: { $ifNull: [{ $arrayElemAt: ["$notes.text", 0] }, null] },
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
    ]);
  }

  async getAllCompleted() {
    return await Contract.aggregate([
      {
        $match: {
          isDeleted: false,
          isActive: true,
          status: ContractStatus.COMPLETED,
        },
      },
    ]);
  }

  async getContractById(contractId: string) {
    const contract = await Contract.aggregate([
      {
        $match: {
          isDeleted: false,
          _id: new Types.ObjectId(contractId),
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "customer",
          foreignField: "_id",
          as: "customer",
          pipeline: [
            {
              $lookup: {
                from: "employees",
                localField: "manager",
                foreignField: "_id",
                as: "manager",
              },
            },
            { $unwind: "$manager" },
            {
              $project: {
                firstName: 1,
                lastName: 1,
                percent: 1,
                passportSeries: 1,
                phoneNumber: 1,
                birthDate: 1,
                telegramName: 1,
                isActive: 1,
                address: 1,
                _id: 1,
                isDeleted: 1,
                "manager.firstName": 1,
                "manager.lastName": 1,
                "manager._id": 1,
              },
            },
          ],
        },
      },
      { $unwind: "$customer" },
      {
        $lookup: {
          from: "notes",
          localField: "notes",
          foreignField: "_id",
          as: "notes",
          pipeline: [{ $project: { text: 1 } }],
        },
      },
      {
        $addFields: {
          notes: { $ifNull: [{ $arrayElemAt: ["$notes.text", 0] }, null] },
        },
      },
      {
        $lookup: {
          from: "payments",
          localField: "payments",
          foreignField: "_id",
          as: "payments",
          pipeline: [
            {
              $lookup: {
                from: "notes",
                localField: "notes",
                foreignField: "_id",
                as: "notes",
                pipeline: [{ $project: { text: 1 } }],
              },
            },
            {
              $addFields: {
                notes: {
                  $ifNull: [{ $arrayElemAt: ["$notes.text", 0] }, ""],
                },
              },
            },
            {
              $project: {
                _id: 1,
                amount: 1,
                actualAmount: 1, // ✅ Haqiqatda to'langan summa
                date: 1,
                isPaid: 1,
                paymentType: 1,
                status: 1,
                remainingAmount: 1,
                excessAmount: 1,
                expectedAmount: 1,
                prepaidAmount: 1,
                notes: 1,
                confirmedAt: 1,
                confirmedBy: 1,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          totalPaid: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$payments",
                    as: "p",
                    cond: { $eq: ["$$p.isPaid", true] },
                  },
                },
                as: "pp",
                in: {
                  $cond: [
                    { $ifNull: ["$$pp.actualAmount", false] },
                    "$$pp.actualAmount",
                    "$$pp.amount",
                  ],
                },
              },
            },
          },
        },
      },
      {
        $addFields: {
          remainingDebt: {
            $subtract: ["$totalPrice", "$totalPaid"],
          },
        },
      },
      {
        $project: {
          _id: 1,
          productName: 1,
          originalPrice: 1,
          price: 1, // ✅ Sotuv narxi
          totalPrice: 1,
          initialPayment: 1,
          initialPaymentDueDate: 1, // ✅ Oldindan to'lov sanasi
          monthlyPayment: 1,
          percentage: 1, // ✅ Foiz
          period: 1, // ✅ Muddat (oy)
          duration: 1, // ✅ Muddat (alternative field)
          startDate: 1, // ✅ Boshlanish sanasi
          endDate: 1, // ✅ Tugash sanasi
          status: 1,
          customer: 1,
          notes: 1,
          payments: 1,
          totalPaid: 1,
          remainingDebt: 1,
          info: 1, // ✅ Qo'shimcha ma'lumotlar (box, mbox, receipt, iCloud)
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ]);
    return contract[0];
  }

  /**
   * Shartnoma yaratish (Dashboard)
   * Requirements: 1.2, 2.3, 3.2
   */
  async create(data: CreateContractDto, user: IJwtUser) {
    try {
      console.log("🚀 === CONTRACT CREATION STARTED ===");
      console.log("📋 Input data:", {
        customer: data.customer,
        productName: data.productName,
        initialPayment: data.initialPayment,
        totalPrice: data.totalPrice,
      });

      const {
        customer,
        productName,
        originalPrice,
        price,
        initialPayment,
        percentage,
        period,
        monthlyPayment,
        initialPaymentDueDate,
        notes,
        totalPrice,
        box,
        mbox,
        receipt,
        iCloud,
        startDate,
      } = data;

      // 1. Employee tekshirish
      const createBy = await Employee.findById(user.sub);
      if (!createBy) {
        throw BaseError.ForbiddenError("Mavjud bo'lmagan xodim");
      }
      console.log("👤 Employee found:", createBy._id);

      // 2. Customer tekshirish
      const customerDoc = await Customer.findById(customer);
      if (!customerDoc) {
        throw BaseError.NotFoundError("Mijoz topilmadi");
      }
      console.log("🤝 Customer found:", customerDoc._id);

      // 3. Notes yaratish
      const newNotes = new Notes({
        text: notes || "Shartnoma yaratildi",
        customer,
        createBy: createBy._id,
      });
      await newNotes.save();
      console.log("📝 Notes created:", newNotes._id);

      // 4. Shartnoma yaratish
      const contractStartDate = startDate ? new Date(startDate) : new Date();

      // Keyingi to'lov sanasi - startDate dan 1 oy keyin
      const nextPaymentDate = new Date(contractStartDate);
      nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

      const contract = new Contract({
        customer,
        productName,
        originalPrice,
        price,
        initialPayment,
        percentage,
        period,
        monthlyPayment,
        initialPaymentDueDate: contractStartDate, // ✅ Shartnoma sanasiga teng
        notes: newNotes._id,
        totalPrice,
        startDate: contractStartDate,
        nextPaymentDate: nextPaymentDate,
        isActive: true,
        createBy: createBy._id,
        info: {
          box: box || false,
          mbox: mbox || false,
          receipt: receipt || false,
          iCloud: iCloud || false,
        },
        payments: [],
        isDeclare: false,
        status: ContractStatus.ACTIVE,
      });

      await contract.save();
      console.log("📋 Contract created:", contract._id);

      // 5. Initial payment yaratish (agar mavjud bo'lsa)
      if (initialPayment && initialPayment > 0) {
        await this.createInitialPayment(contract, initialPayment, user);

        // 6. Balance yangilash
        await this.updateBalance(createBy._id, {
          dollar: initialPayment,
          sum: 0,
        });
        console.log("💵 Balance updated with initial payment:", initialPayment);
      }

      // ❌ Debtor yaratilmaydi - faqat muddati o'tganda avtomatik yaratiladi

      console.log("🎉 === CONTRACT CREATION COMPLETED ===");
      return {
        message: "Shartnoma yaratildi.",
        contractId: contract._id,
      };
    } catch (error) {
      console.error("❌ === CONTRACT CREATION FAILED ===");
      console.error("Error:", error);
      throw error;
    }
  }

  /**
   * Edit history saqlash metodi
   * Requirements: 8.1, 8.2, 8.3
   */
  private async saveEditHistory(
    contract: any,
    changes: Array<{
      field: string;
      oldValue: any;
      newValue: any;
      difference: number;
    }>,
    affectedPayments: Types.ObjectId[],
    impactSummary: {
      underpaidCount: number;
      overpaidCount: number;
      totalShortage: number;
      totalExcess: number;
      additionalPaymentsCreated: number;
    },
    user: IJwtUser
  ): Promise<void> {
    console.log("📝 === SAVING EDIT HISTORY ===");

    try {
      // 1. IContractEdit object yaratish (Requirement 8.1, 8.2)
      const editEntry = {
        date: new Date(),
        editedBy: new Types.ObjectId(user.sub),
        changes: changes.map((change) => ({
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          difference: change.difference,
        })),
        affectedPayments: affectedPayments,
        impactSummary: {
          underpaidCount: impactSummary.underpaidCount,
          overpaidCount: impactSummary.overpaidCount,
          totalShortage: impactSummary.totalShortage,
          totalExcess: impactSummary.totalExcess,
          additionalPaymentsCreated: impactSummary.additionalPaymentsCreated,
        },
      };

      console.log("📋 Edit entry created:", {
        date: editEntry.date,
        editedBy: editEntry.editedBy,
        changesCount: editEntry.changes.length,
        affectedPaymentsCount: editEntry.affectedPayments.length,
      });

      // 2. Contract.editHistory ga qo'shish (Requirement 8.3)
      if (!contract.editHistory) {
        contract.editHistory = [];
      }

      contract.editHistory.push(editEntry);
      await contract.save();

      console.log("✅ Edit history saved successfully");
      console.log(
        `📊 Total edit history entries: ${contract.editHistory.length}`
      );
    } catch (error) {
      console.error("❌ Error saving edit history:", error);
      throw error;
    }
  }

  /**
   * Shartnoma yangilash (REFACTORED - Task 10.1)
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
   *
   * Bu metod barcha helper metodlarni integratsiya qiladi va
   * shartnoma tahrirlashning to'liq lifecycle'ini boshqaradi:
   * 1. O'zgarishlarni hisoblash
   * 2. Validatsiya
   * 3. Impact tahlili
   * 4. Har bir o'zgarish uchun tegishli handler chaqirish
   * 5. Contract ma'lumotlarini yangilash
   * 6. Edit history saqlash
   * 7. Success response qaytarish
   */
  async update(data: UpdateContractDto, user: IJwtUser) {
    const startTime = Date.now();
    let auditLogSuccess = false;
    let auditLogError: string | undefined;

    try {
      console.log("🔄 === CONTRACT UPDATE STARTED ===");
      console.log("📋 Contract ID:", data.id);
      console.log("👤 User:", user.sub);

      // ========================================
      // SECURITY 1: RATE LIMITING
      // ========================================
      const rateLimitCheck = checkRateLimit(user.sub, 10, 60000);
      if (!rateLimitCheck.allowed) {
        throw BaseError.BadRequest(
          `Too many requests. Please try again in ${rateLimitCheck.retryAfter} seconds.`
        );
      }

      // ========================================
      // SECURITY 2: AUTHORIZATION CHECK
      // ========================================
      console.log("🔒 Verifying permissions...");
      const authCheck = await verifyContractEditPermission(user.sub, data.id);
      if (!authCheck.authorized) {
        throw BaseError.ForbiddenError(
          `Shartnomani tahrirlash uchun ruxsat yo'q: ${authCheck.reason}`
        );
      }
      console.log("✅ Authorization verified");

      // ========================================
      // SECURITY 3: INPUT VALIDATION
      // ========================================
      console.log("🔍 Validating input...");
      const inputValidation = validateContractEditInput({
        monthlyPayment: data.monthlyPayment,
        initialPayment: data.initialPayment,
        totalPrice: data.totalPrice,
        productName: data.productName,
        notes: data.notes,
      });

      if (!inputValidation.valid) {
        throw BaseError.BadRequest(
          `Input validation failed: ${inputValidation.errors.join(", ")}`
        );
      }
      console.log("✅ Input validation passed");

      // ========================================
      // 1. SHARTNOMANI TOPISH
      // ========================================
      const contract = await Contract.findOne({
        _id: data.id,
        isDeleted: false,
      })
        .populate("notes")
        .populate("payments");

      if (!contract) {
        throw BaseError.NotFoundError("Shartnoma topilmadi yoki o'chirilgan");
      }

      console.log("✅ Contract found:", sanitizeContractForLogging(contract));

      // ========================================
      // 2. O'ZGARISHLARNI HISOBLASH (Requirement 1.1)
      // ========================================
      console.log("📊 === CALCULATING CHANGES ===");

      const changes: Array<{
        field: string;
        oldValue: any;
        newValue: any;
        difference: number;
      }> = [];

      // Monthly payment o'zgarishi
      const monthlyPaymentDiff =
        (data.monthlyPayment !== undefined
          ? data.monthlyPayment
          : contract.monthlyPayment) - contract.monthlyPayment;

      if (monthlyPaymentDiff !== 0) {
        changes.push({
          field: "monthlyPayment",
          oldValue: contract.monthlyPayment,
          newValue:
            data.monthlyPayment !== undefined
              ? data.monthlyPayment
              : contract.monthlyPayment,
          difference: monthlyPaymentDiff,
        });
        console.log(
          `📅 Monthly payment change: ${contract.monthlyPayment} → ${
            data.monthlyPayment !== undefined
              ? data.monthlyPayment
              : contract.monthlyPayment
          } (${monthlyPaymentDiff > 0 ? "+" : ""}${monthlyPaymentDiff})`
        );
      }

      // Initial payment o'zgarishi
      console.log("🔍 DEBUG Initial Payment:", {
        "data.initialPayment": data.initialPayment,
        "contract.initialPayment": contract.initialPayment,
        "data.initialPayment !== undefined": data.initialPayment !== undefined,
      });

      const initialPaymentDiff =
        (data.initialPayment !== undefined
          ? data.initialPayment
          : contract.initialPayment) - contract.initialPayment;

      if (initialPaymentDiff !== 0) {
        const oldValue = contract.initialPayment;
        const newValue =
          data.initialPayment !== undefined
            ? data.initialPayment
            : contract.initialPayment;

        console.log("🔍 DEBUG Change Object:", {
          field: "initialPayment",
          oldValue,
          newValue,
          difference: initialPaymentDiff,
          "oldValue > 0": oldValue > 0,
          "newValue > 0": newValue > 0,
        });

        changes.push({
          field: "initialPayment",
          oldValue,
          newValue,
          difference: initialPaymentDiff,
        });
        console.log(
          `💰 Initial payment change: ${oldValue} → ${newValue} (${
            initialPaymentDiff > 0 ? "+" : ""
          }${initialPaymentDiff})`
        );
      }

      // Total price o'zgarishi
      const totalPriceDiff =
        (data.totalPrice !== undefined
          ? data.totalPrice
          : contract.totalPrice) - contract.totalPrice;

      if (totalPriceDiff !== 0) {
        changes.push({
          field: "totalPrice",
          oldValue: contract.totalPrice,
          newValue:
            data.totalPrice !== undefined
              ? data.totalPrice
              : contract.totalPrice,
          difference: totalPriceDiff,
        });
        console.log(
          `📊 Total price change: ${contract.totalPrice} → ${
            data.totalPrice !== undefined
              ? data.totalPrice
              : contract.totalPrice
          } (${totalPriceDiff > 0 ? "+" : ""}${totalPriceDiff})`
        );
      }

      console.log(`✅ Detected ${changes.length} change(s)`);

      // ========================================
      // 3. VALIDATSIYA (Requirement 1.2)
      // ========================================
      if (changes.length > 0) {
        console.log("🔍 === VALIDATING CHANGES ===");
        await this.validateContractEdit(contract, changes);
        console.log("✅ Validation passed");
      } else {
        console.log("ℹ️ No critical changes detected, skipping validation");
      }

      // ========================================
      // 4. IMPACT TAHLILI (Requirement 1.3, 1.4)
      // ========================================
      console.log("📊 === ANALYZING IMPACT ===");
      const impactSummary = await this.analyzeEditImpact(contract, changes);
      console.log("✅ Impact analysis completed:", {
        underpaidCount: impactSummary.underpaidCount,
        overpaidCount: impactSummary.overpaidCount,
        totalShortage: impactSummary.totalShortage.toFixed(2),
        totalExcess: impactSummary.totalExcess.toFixed(2),
        additionalPaymentsCreated: impactSummary.additionalPaymentsCreated,
      });

      // ========================================
      // 5. HAR BIR O'ZGARISH UCHUN HANDLER CHAQIRISH (Requirement 1.5)
      // ========================================
      const affectedPayments: Types.ObjectId[] = [];

      // 5.1. Monthly Payment Handler
      if (monthlyPaymentDiff !== 0) {
        console.log("🔄 === HANDLING MONTHLY PAYMENT CHANGE ===");
        const affected = await this.handleMonthlyPaymentChange(
          contract,
          contract.monthlyPayment,
          data.monthlyPayment!
        );
        affectedPayments.push(...affected);
        console.log(`✅ Affected ${affected.length} payment(s)`);
      }

      // 5.2. Initial Payment Handler
      if (initialPaymentDiff !== 0) {
        console.log("🔄 === HANDLING INITIAL PAYMENT CHANGE ===");
        const affectedPaymentId = await this.handleInitialPaymentChange(
          contract,
          initialPaymentDiff,
          user
        );
        if (affectedPaymentId) {
          affectedPayments.push(affectedPaymentId);
          console.log(`✅ Affected initial payment: ${affectedPaymentId}`);
        }
      }

      // 5.3. Total Price Handler
      if (totalPriceDiff !== 0) {
        console.log("🔄 === HANDLING TOTAL PRICE CHANGE ===");
        await this.handleTotalPriceChange(contract, data.totalPrice!);
        console.log("✅ Total price change handled");
      }

      // ========================================
      // 6. CONTRACT MA'LUMOTLARINI YANGILASH
      // ========================================
      console.log("📝 === UPDATING CONTRACT DATA ===");

      // Notes yangilash
      if (data.notes && contract.notes) {
        const contractNotes = contract.notes as any;
        if (data.notes !== contractNotes.text) {
          contractNotes.text = data.notes;
          await contractNotes.save();
          console.log("✅ Notes updated");
        }
      }

      // Contract fieldlarini yangilash
      Object.assign(contract, {
        productName: data.productName,
        originalPrice: data.originalPrice,
        price: data.price,
        initialPayment: data.initialPayment,
        percentage: data.percentage,
        period: data.period,
        monthlyPayment: data.monthlyPayment,
        totalPrice: data.totalPrice,
        initialPaymentDueDate: data.initialPaymentDueDate,
        nextPaymentDate: data.initialPaymentDueDate,
        info: {
          box: data.box,
          mbox: data.mbox,
          receipt: data.receipt,
          iCloud: data.iCloud,
        },
      });

      console.log("✅ Contract data updated");

      // ========================================
      // 7. EDIT HISTORY SAQLASH (Requirement 8.1, 8.2, 8.3)
      // ========================================
      if (changes.length > 0) {
        console.log("📝 === SAVING EDIT HISTORY ===");
        await this.saveEditHistory(
          contract,
          changes,
          affectedPayments,
          impactSummary,
          user
        );
        console.log("✅ Edit history saved");
      }

      // Contract'ni saqlash
      await contract.save();

      // ========================================
      // 8. SUCCESS RESPONSE QAYTARISH
      // ========================================
      auditLogSuccess = true;
      const executionTime = Date.now() - startTime;

      console.log("🎉 === CONTRACT UPDATE COMPLETED ===");
      console.log("📊 Summary:", {
        changesCount: changes.length,
        affectedPaymentsCount: affectedPayments.length,
        underpaidCount: impactSummary.underpaidCount,
        overpaidCount: impactSummary.overpaidCount,
        additionalPaymentsCreated: impactSummary.additionalPaymentsCreated,
        executionTimeMs: executionTime,
      });

      // ========================================
      // SECURITY 4: AUDIT LOGGING
      // ========================================
      const employee = await Employee.findById(user.sub).select(
        "firstName lastName"
      );
      await createAuditLog({
        timestamp: new Date(),
        userId: user.sub,
        userName: employee
          ? `${employee.firstName} ${employee.lastName}`
          : "Unknown",
        action: "CONTRACT_UPDATE",
        resourceType: "Contract",
        resourceId: data.id,
        changes: changes.map((c) => ({
          field: c.field,
          oldValue: c.oldValue,
          newValue: c.newValue,
        })),
        success: true,
      });

      return {
        message: "Shartnoma muvaffaqiyatli yangilandi",
        changes,
        impactSummary,
        affectedPayments: affectedPayments.length,
      };
    } catch (error) {
      console.error("❌ === CONTRACT UPDATE FAILED ===");
      console.error("Error:", error);

      // ========================================
      // SECURITY 5: AUDIT LOGGING (FAILURE)
      // ========================================
      auditLogError = error instanceof Error ? error.message : String(error);
      try {
        const employee = await Employee.findById(user.sub).select(
          "firstName lastName"
        );
        await createAuditLog({
          timestamp: new Date(),
          userId: user.sub,
          userName: employee
            ? `${employee.firstName} ${employee.lastName}`
            : "Unknown",
          action: "CONTRACT_UPDATE",
          resourceType: "Contract",
          resourceId: data.id,
          changes: [],
          success: false,
          errorMessage: auditLogError,
        });
      } catch (auditError) {
        console.error("❌ Failed to create audit log:", auditError);
      }

      throw error;
    }
  }

  /**
   * Seller shartnomasi yaratish
   * Requirements: 6.1
   */
  async sellerCreate(data: CreateContractDto, user: IJwtUser) {
    const {
      customer,
      productName,
      originalPrice,
      price,
      initialPayment,
      percentage,
      period,
      monthlyPayment,
      initialPaymentDueDate,
      notes,
      totalPrice,
      box,
      mbox,
      receipt,
      iCloud,
      startDate,
    } = data;

    const createBy = await Employee.findById(user.sub);
    if (!createBy) {
      throw BaseError.ForbiddenError();
    }

    const newNotes = new Notes({ text: notes, customer, createBy });
    await newNotes.save();

    const contractStartDate = startDate ? new Date(startDate) : new Date();

    const contract = new Contract({
      customer,
      productName,
      originalPrice,
      price,
      initialPayment,
      percentage,
      period,
      monthlyPayment,
      initialPaymentDueDate: contractStartDate, // ✅ Shartnoma sanasiga teng
      notes: newNotes,
      totalPrice,
      startDate: contractStartDate,
      nextPaymentDate: contractStartDate, // ✅ Shartnoma sanasiga teng
      isActive: false, // ⚠️ Tasdiq kutilmoqda
      createBy,
      info: {
        box,
        mbox,
        receipt,
        iCloud,
      },
    });
    await contract.save();

    return { message: "Shartnoma yaratildi va tasdiq kutilmoqda." };
  }

  /**
   * Seller shartnomasi tasdiqlash
   * Requirements: 6.2, 6.3, 6.4, 6.5
   */
  async approveContract(contractId: string, user: IJwtUser) {
    try {
      console.log("🔍 Approving contract:", contractId);

      const contract = await Contract.findOne({
        _id: contractId,
        isDeleted: false,
        isActive: false,
      });

      if (!contract) {
        throw BaseError.NotFoundError(
          "Shartnoma topilmadi yoki allaqachon tasdiqlangan"
        );
      }

      const approver = await Employee.findById(user.sub).populate("role");
      if (!approver) {
        throw BaseError.ForbiddenError("Mavjud bo'lmagan xodim");
      }

      // Faqat admin, moderator, manager tasdiqlashi mumkin
      const allowedRoles = ["admin", "moderator", "manager"];
      if (!allowedRoles.includes(approver.role?.name || "")) {
        throw BaseError.ForbiddenError(
          "Shartnomani tasdiqlash uchun ruxsat yo'q"
        );
      }

      // 1. Shartnomani tasdiqlash
      contract.isActive = true;
      await contract.save();

      // 2. Initial payment yaratish (agar mavjud bo'lsa)
      if (contract.initialPayment && contract.initialPayment > 0) {
        await this.createInitialPayment(
          contract,
          contract.initialPayment,
          user
        );

        // 3. Balance yangilash
        await this.updateBalance(approver._id, {
          dollar: contract.initialPayment,
          sum: 0,
        });
      }

      // ❌ Debtor yaratilmaydi - faqat muddati o'tganda avtomatik yaratiladi

      console.log("✅ Contract approved:", contract._id);

      return {
        message: "Shartnoma tasdiqlandi va faollashtirildi",
        contractId: contract._id,
      };
    } catch (error) {
      console.error("❌ Error approving contract:", error);
      throw error;
    }
  }

  /**
   * Ta'sir tahlili - shartnoma tahrirlashdan oldin
   * Public metod - frontend uchun
   * Requirements: 1.2, 1.3, 1.4, 1.5
   */
  async analyzeContractEditImpact(
    contractId: string,
    newValues: {
      monthlyPayment?: number;
      initialPayment?: number;
      totalPrice?: number;
    }
  ) {
    try {
      console.log("📊 === ANALYZING EDIT IMPACT (PUBLIC) ===");
      console.log("Contract ID:", contractId);
      console.log("New values:", newValues);

      // 1. Shartnomani topish
      const contract = await Contract.findById(contractId).populate("payments");

      if (!contract) {
        throw BaseError.NotFoundError("Shartnoma topilmadi");
      }

      // 2. O'zgarishlarni hisoblash
      const changes = [];

      if (
        newValues.monthlyPayment !== undefined &&
        newValues.monthlyPayment !== contract.monthlyPayment
      ) {
        changes.push({
          field: "monthlyPayment",
          oldValue: contract.monthlyPayment,
          newValue: newValues.monthlyPayment,
          difference: newValues.monthlyPayment - contract.monthlyPayment,
        });
      }

      if (
        newValues.initialPayment !== undefined &&
        newValues.initialPayment !== contract.initialPayment
      ) {
        changes.push({
          field: "initialPayment",
          oldValue: contract.initialPayment,
          newValue: newValues.initialPayment,
          difference: newValues.initialPayment - contract.initialPayment,
        });
      }

      if (
        newValues.totalPrice !== undefined &&
        newValues.totalPrice !== contract.totalPrice
      ) {
        changes.push({
          field: "totalPrice",
          oldValue: contract.totalPrice,
          newValue: newValues.totalPrice,
          difference: newValues.totalPrice - contract.totalPrice,
        });
      }

      // 3. Agar o'zgarish bo'lmasa
      if (changes.length === 0) {
        return {
          impactSummary: {
            underpaidCount: 0,
            overpaidCount: 0,
            totalShortage: 0,
            totalExcess: 0,
            additionalPaymentsCreated: 0,
          },
          changes: [],
        };
      }

      // 4. Impact tahlili (faqat monthly payment uchun)
      const impactSummary = await this.analyzeEditImpact(contract, changes);

      console.log("✅ Impact analysis completed:", impactSummary);

      return {
        impactSummary,
        changes,
      };
    } catch (error) {
      console.error("❌ Error analyzing impact:", error);
      throw error;
    }
  }
}

export default new ContractService();
