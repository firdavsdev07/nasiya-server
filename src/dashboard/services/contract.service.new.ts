import BaseError from "../../utils/base.error";
import Contract, { ContractStatus } from "../../schemas/contract.schema";
import { CreateContractDto } from "../../validators/contract";
import IJwtUser from "../../types/user";
import Employee from "../../schemas/employee.schema";
import Notes from "../../schemas/notes.schema";
import Customer from "../../schemas/customer.schema";
import Payment from "../../schemas/payment.schema";
import { Balance } from "../../schemas/balance.schema";
import { Debtor } from "../../schemas/debtor.schema";

class ContractService {
  // Balansni yangilash funksiyasi
  async updateBalance(
    managerId: any,
    changes: { dollar?: number; sum?: number }
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

  async create(data: CreateContractDto, user: IJwtUser) {
    try {
      console.log("🚀 === CONTRACT CREATION STARTED ===");
      console.log("📋 Input data:", {
        customer: data.customer,
        productName: data.productName,
        initialPayment: data.initialPayment,
        totalPrice: data.totalPrice,
        paymentsCount: data.payments?.length || 0,
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
        payments = [],
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
        startDate: contractStartDate,
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
      console.log("📋 Contract created:", contract._id);

      // 5. INITIAL PAYMENT'ni Payment collection'ga qo'shish
      const allPayments = [];

      if (initialPayment && initialPayment > 0) {
        console.log("💰 Processing initial payment:", initialPayment);

        const initialPaymentNote = new Notes({
          text: `Boshlang'ich to'lov: ${initialPayment}`,
          customer,
          createBy: createBy._id,
        });
        await initialPaymentNote.save();

        const initialPaymentDoc = new Payment({
          amount: initialPayment,
          date: contractStartDate,
          isPaid: true,
          customerId: customer,
          managerId: createBy._id,
          notes: initialPaymentNote._id,
        });
        await initialPaymentDoc.save();
        allPayments.push(initialPaymentDoc._id);

        console.log(
          "✅ Initial payment saved to Payment collection:",
          initialPaymentDoc._id
        );
      }

      // 6. Additional payments yaratish
      for (const payment of payments) {
        if (!payment.amount || payment.amount <= 0) {
          continue;
        }

        const paymentNote = new Notes({
          text: payment.note || `To'lov: ${payment.amount}`,
          customer,
          createBy: createBy._id,
        });
        await paymentNote.save();

        const newPayment = new Payment({
          amount: payment.amount,
          date: new Date(payment.date),
          isPaid: true,
          customerId: customer,
          managerId: createBy._id,
          notes: paymentNote._id,
        });

        await newPayment.save();
        allPayments.push(newPayment._id);
        console.log("✅ Additional payment saved:", newPayment._id);
      }

      // 7. Contract'ga barcha to'lovlarni bog'lash
      if (allPayments.length > 0) {
        contract.payments = allPayments.map((id) => id.toString());
        await contract.save();
        console.log("🔗 All payments linked to contract:", allPayments.length);
      }

      // 8. Balance yangilash
      if (initialPayment && initialPayment > 0) {
        await this.updateBalance(createBy._id, {
          dollar: initialPayment,
          sum: 0,
        });
      }

      // 9. Debtor yaratish (har doim yaratish - kelajakdagi to'lovlar uchun ham)
      try {
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

        console.log("⚠️ Debtor created:", newDebtor._id);
      } catch (debtorError) {
        console.error("❌ Error creating debtor:", debtorError);
      }

      console.log("🎉 === CONTRACT CREATION COMPLETED ===");
      return {
        message: "Shartnoma yaratildi.",
        contractId: contract._id,
        paymentsCount: allPayments.length,
        initialPaymentProcessed: initialPayment > 0,
      };
    } catch (error) {
      console.error("❌ === CONTRACT CREATION FAILED ===");
      console.error("Error:", error);
      throw error;
    }
  }
}

export default new ContractService();
