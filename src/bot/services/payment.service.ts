import Contract from "../../schemas/contract.schema";
import Employee, { IEmployee } from "../../schemas/employee.schema";
import IJwtUser from "../../types/user";
import { IPayment } from "../../schemas/payment.schema";
import { Debtor } from "../../schemas/debtor.schema";
import BaseError from "../../utils/base.error";
import { PayDebtDto, PayNewDebtDto } from "../../validators/payment";
import Notes from "../../schemas/notes.schema";
import { Balance } from "../../schemas/balance.schema";

class PaymentSrvice {
  async updateBalance(
    managerId: IEmployee,
    changes: {
      dollar?: number;
      sum?: number;
    }
  ) {
    const balance = await Balance.findOne({ managerId });

    if (!balance) {
      return await Balance.create({
        managerId,
        ...changes,
      });
    }

    balance.dollar += changes.dollar || 0;
    balance.sum += changes.sum || 0;

    return await balance.save();
  }

  async payDebt(payData: PayDebtDto, user: IJwtUser) {
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

    const notes = new Notes({
      text: payData.notes,
      customer,
      createBy: manager,
    });
    await notes.save();

    // ⏳ YANGI LOGIKA - To'lovlar PENDING statusda yaratiladi (kassa tasdiqlashi kerak)
    const Payment = (await import("../../schemas/payment.schema")).default;
    const { PaymentType, PaymentStatus } = await import(
      "../../schemas/payment.schema"
    );
    const Contract = (await import("../../schemas/contract.schema")).default;

    const contract = await Contract.findById(existingDebtor.contractId._id);

    const paymentDoc = await Payment.create({
      amount: payData.amount,
      date: new Date(),
      isPaid: false, // ❌ Hali tasdiqlanmagan
      paymentType: PaymentType.MONTHLY,
      notes: notes._id,
      customerId: customer,
      managerId: manager._id,
      status: PaymentStatus.PENDING, // ⏳ PENDING - kassaga tushadi
      expectedAmount: contract?.monthlyPayment,
    });

    console.log("✅ Payment created (PENDING - Bot):", paymentDoc._id);
    console.log("⏳ Waiting for cash confirmation...");

    // ✅ YANGI: nextPaymentDate ni DARHOL yangilash (botda ko'rish uchun)
    if (contract && contract.nextPaymentDate) {
      const currentDate = new Date(contract.nextPaymentDate);

      // ✅ To'lov sanasi har doim bir xil kun bo'lib turishi kerak
      // Masalan: 10-Dekabr → 10-Yanvar (qachon to'lasangiz ham)
      const nextMonth = new Date(currentDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      contract.nextPaymentDate = nextMonth;

      // Agar kechiktirilgan bo'lsa, tozalash
      if (contract.previousPaymentDate) {
        contract.previousPaymentDate = undefined;
        contract.postponedAt = undefined;
      }

      await contract.save();
      console.log("📅 nextPaymentDate updated immediately (Bot):", {
        old: currentDate.toLocaleDateString("uz-UZ"),
        new: nextMonth.toLocaleDateString("uz-UZ"),
      });
    }

    // ❌ Balance yangilanmaydi - faqat kassa tasdiqlanganda
    // ❌ Contract.payments ga qo'shilmaydi - faqat kassa tasdiqlanganda
    // ❌ Debtor o'chirilmaydi - faqat kassa tasdiqlanganda

    return {
      status: "success",
      message: "To'lov qabul qilindi, kassa tasdiqlashi kutilmoqda",
      paymentId: paymentDoc._id,
      isPending: true, // ⏳ Kassa tasdiqlashi kerak
    };
  }

  async payNewDebt(payData: PayNewDebtDto, user: IJwtUser) {
    const existingContract = await Contract.findById(payData.id);

    if (!existingContract) {
      throw BaseError.NotFoundError("Shartnoma topilmadi yoki o'chirilgan");
    }
    const customer = existingContract.customer;
    const manager = await Employee.findById(user.sub);

    if (!manager) {
      throw BaseError.NotFoundError("Menejer topilmadi yoki o'chirilgan");
    }

    const notes = new Notes({
      text: payData.notes,
      customer: customer,
      createBy: manager,
    });
    await notes.save();

    // ⏳ YANGI LOGIKA - To'lovlar PENDING statusda yaratiladi (kassa tasdiqlashi kerak)
    const Payment = (await import("../../schemas/payment.schema")).default;
    const { PaymentType, PaymentStatus } = await import(
      "../../schemas/payment.schema"
    );

    const paymentDoc = await Payment.create({
      amount: payData.amount,
      date: new Date(),
      isPaid: false, // ❌ Hali tasdiqlanmagan
      paymentType: PaymentType.MONTHLY,
      notes: notes._id,
      customerId: customer,
      managerId: manager._id,
      status: PaymentStatus.PENDING, // ⏳ PENDING - kassaga tushadi
      expectedAmount: existingContract.monthlyPayment,
    });

    console.log("✅ Payment created (PENDING - Bot):", paymentDoc._id);
    console.log("⏳ Waiting for cash confirmation...");

    // ✅ YANGI: nextPaymentDate ni DARHOL yangilash (botda ko'rish uchun)
    if (existingContract && existingContract.nextPaymentDate) {
      const currentDate = new Date(existingContract.nextPaymentDate);

      // ✅ To'lov sanasi har doim bir xil kun bo'lib turishi kerak
      // Masalan: 10-Dekabr → 10-Yanvar (qachon to'lasangiz ham)
      const nextMonth = new Date(currentDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      existingContract.nextPaymentDate = nextMonth;

      // Agar kechiktirilgan bo'lsa, tozalash
      if (existingContract.previousPaymentDate) {
        existingContract.previousPaymentDate = undefined;
        existingContract.postponedAt = undefined;
      }

      await existingContract.save();
      console.log("📅 nextPaymentDate updated immediately (Bot):", {
        old: currentDate.toLocaleDateString("uz-UZ"),
        new: nextMonth.toLocaleDateString("uz-UZ"),
      });
    }

    // ❌ Balance yangilanmaydi - faqat kassa tasdiqlanganda
    // ❌ Contract.payments ga qo'shilmaydi - faqat kassa tasdiqlanganda

    return {
      status: "success",
      message: "To'lov qabul qilindi, kassa tasdiqlashi kutilmoqda",
      paymentId: paymentDoc._id,
      isPending: true, // ⏳ Kassa tasdiqlashi kerak
    };
  }

  /**
   * To'lovni keyinga qoldirish
   * Shartnomaning keyingi to'lov sanasini o'zgartirish
   */
  async postponePayment(
    contractId: string,
    postponeDate: string,
    reason: string,
    user: IJwtUser
  ) {
    console.log("\n" + "=".repeat(60));
    console.log("📅 TO'LOVNI KEYINGA QOLDIRISH");
    console.log("=".repeat(60));

    // Shartnomani topish
    const contract = await Contract.findById(contractId);

    if (!contract) {
      throw BaseError.NotFoundError("Shartnoma topilmadi");
    }

    console.log("✅ Shartnoma topildi:", contract.productName);
    console.log("📅 Hozirgi keyingi to'lov sanasi:", contract.nextPaymentDate);

    // Yangi sanani tekshirish
    const newDate = new Date(postponeDate);
    const today = new Date();

    if (newDate < today) {
      throw BaseError.BadRequest(
        "Keyingi to'lov sanasi bugundan oldingi sana bo'lishi mumkin emas"
      );
    }

    // Eski sanani saqlash
    const oldDate = contract.nextPaymentDate;

    // Yangi sanani o'rnatish
    contract.nextPaymentDate = newDate;

    // Eski sanani previousPaymentDate ga saqlash (kechiktirilgan sana)
    contract.previousPaymentDate = oldDate;
    contract.postponedAt = new Date();

    await contract.save();

    console.log("✅ Yangi keyingi to'lov sanasi:", newDate);
    console.log("📊 Saqlangan ma'lumotlar:", {
      previousPaymentDate: contract.previousPaymentDate,
      nextPaymentDate: contract.nextPaymentDate,
      postponedAt: contract.postponedAt,
    });

    // Notes yaratish
    const manager = await Employee.findById(user.sub);
    if (!manager) {
      throw BaseError.NotFoundError("Manager topilmadi");
    }

    const notes = new Notes({
      text: `To'lov keyinga qoldirildi. Shartnoma: ${contract.productName}. Sabab: ${reason}. Eski sana: ${oldDate?.toLocaleDateString("uz-UZ")}, Yangi sana: ${newDate.toLocaleDateString("uz-UZ")}`,
      customer: contract.customer,
      createBy: manager,
    });
    await notes.save();

    console.log("✅ Notes yaratildi");
    console.log("=".repeat(60) + "\n");

    return {
      status: "success",
      message: "To'lov sanasi muvaffaqiyatli o'zgartirildi",
      contract: {
        _id: contract._id,
        productName: contract.productName,
        oldDate: oldDate,
        newDate: newDate,
      },
    };
  }
}

export default new PaymentSrvice();
