import BaseError from "../../utils/base.error";
import Contract, { ContractStatus } from "../../schemas/contract.schema";
import {
  CreateContractDto,
  SellerCreateContractDto,
  UpdateContractDto,
} from "../../validators/contract";
import IJwtUser from "../../types/user";
import Employee from "../../schemas/employee.schema";
import Notes from "../../schemas/notes.schema";
import { Types } from "mongoose";
import Customer from "../../schemas/customer.schema";
import Payment from "../../schemas/payment.schema";
import { Balance } from "../../schemas/balance.schema";

class ContractService {
  // Balansni yangilash funksiyasi
  async updateBalance(
    managerId: any,
    changes: {
      dollar?: number;
      sum?: number;
    }
  ) {
    try {
      let balance = await Balance.findOne({ managerId });

      if (!balance) {
        // Agar balans yo'q bo'lsa, yangi yaratamiz
        balance = await Balance.create({
          managerId,
          dollar: changes.dollar || 0,
          sum: changes.sum || 0,
        });
        console.log("New balance created:", balance._id);
      } else {
        // Balansga qo'shamiz
        balance.dollar += changes.dollar || 0;
        balance.sum += changes.sum || 0;
        await balance.save();
        console.log("Balance updated:", balance._id);
      }

      return balance;
    } catch (error) {
      console.error("Error updating balance:", error);
      throw error;
    }
  }

  async create(data: CreateContractDto, user: IJwtUser) {
    try {
      console.log("=== CONTRACT CREATION STARTED ===");
      console.log("Input data:", JSON.stringify(data, null, 2));

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
        payments = [],
      } = data;

      // 1. Employee tekshirish
      const createBy = await Employee.findById(user.sub);
      if (!createBy) {
        throw BaseError.ForbiddenError("Mavjud bo'lmagan xodim");
      }
      console.log("Employee found:", createBy._id);

      // 2. Customer tekshirish
      const customerDoc = await Customer.findById(customer);
      if (!customerDoc) {
        throw BaseError.NotFoundError("Mijoz topilmadi");
      }
      console.log("Customer found:", customerDoc._id);

      // 3. Notes yaratish
      const newNotes = new Notes({
        text: notes || "Shartnoma yaratildi",
        customer,
        createBy: createBy._id,
      });
      await newNotes.save();
      console.log("Notes created:", newNotes._id);

      // 4. Shartnoma yaratish
      const contract = new Contract({
        customer,
        productName,
        originalPrice,
        price,
        initialPayment,
        percentage,
        period,
        monthlyPayment,
        initialPaymentDueDate: new Date(initialPaymentDueDate),
        notes: newNotes._id,
        totalPrice,
        startDate: startDate ? new Date(startDate) : new Date(),
        nextPaymentDate: new Date(initialPaymentDueDate),
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
      console.log("Contract created:", contract._id);

      // 5. To'lovlarni yaratish
      const savedPayments = [];
      if (payments && payments.length > 0) {
        console.log("Creating payments:", payments.length);

        for (const payment of payments) {
          if (!payment.amount || payment.amount <= 0) {
            console.log("Skipping invalid payment:", payment);
            continue;
          }

          // Payment uchun notes yaratish
          const paymentNote = new Notes({
            text: payment.note || `To'lov: ${payment.amount}`,
            customer,
            createBy: createBy._id,
          });
          await paymentNote.save();

          // Payment yaratish
          const newPayment = new Payment({
            amount: payment.amount,
            date: new Date(payment.date),
            isPaid: true,
            customerId: customer,
            managerId: createBy._id,
            notes: paymentNote._id,
          });

          await newPayment.save();
          savedPayments.push(newPayment._id);
          console.log(
            "Payment created:",
            newPayment._id,
            "Amount:",
            payment.amount
          );
        }

        // Shartnomaga to'lovlarni bog'lash
        if (savedPayments.length > 0) {
          contract.payments = savedPayments.map((id) => id.toString());
          await contract.save();
          console.log("Payments linked to contract:", savedPayments.length);
        }
      }

      // 6. Initial payment balansga qo'shish
      if (initialPayment && initialPayment > 0) {
        try {
          await this.updateBalance(createBy._id, {
            dollar: initialPayment,
            sum: 0,
          });
          console.log("Balance updated with initial payment:", initialPayment);
        } catch (balanceError) {
          console.error("Error updating balance:", balanceError);
        }
      }

      // 7. Debtor yaratish (agar kerak bo'lsa)
      const nextPaymentDate = new Date(initialPaymentDueDate);
      const today = new Date();

      if (nextPaymentDate <= today) {
        try {
          const { Debtor } = await import("../../schemas/debtor.schema");

          const newDebtor = await Debtor.create({
            contractId: contract._id,
            debtAmount: monthlyPayment,
            createBy: createBy._id,
            currencyDetails: {
              dollar: 0,
              sum: 0,
            },
            currencyCourse: 12500,
          });

          console.log("Debtor created:", newDebtor._id);
        } catch (debtorError) {
          console.error("Error creating debtor:", debtorError);
        }
      }

      console.log("=== CONTRACT CREATION COMPLETED ===");
      return {
        message: "Shartnoma yaratildi.",
        contractId: contract._id,
        paymentsCount: savedPayments.length,
        balanceUpdated: initialPayment > 0,
      };
    } catch (error) {
      console.error("=== CONTRACT CREATION FAILED ===");
      console.error("Error:", error);
      throw error;
    }
  }
}

export default new ContractService();
