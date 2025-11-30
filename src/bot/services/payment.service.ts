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

    // ✅ YANGI LOGIKA: Ortiqcha/kam summani hisoblash
    const amountPaid = payData.amount;
    const expectedMonthlyPayment = contract?.monthlyPayment || 0;

    let calculatedExcessAmount = 0;
    let calculatedRemainingAmount = 0;

    if (amountPaid > expectedMonthlyPayment) {
      calculatedExcessAmount = amountPaid - expectedMonthlyPayment;
    } else if (amountPaid < expectedMonthlyPayment) {
      calculatedRemainingAmount = expectedMonthlyPayment - amountPaid;
    }

    const paymentDoc = await Payment.create({
      amount: payData.amount,
      date: new Date(),
      isPaid: false,
      paymentType: PaymentType.MONTHLY,
      notes: notes._id,
      customerId: customer,
      managerId: manager._id,
      status: PaymentStatus.PENDING,
      expectedAmount: expectedMonthlyPayment, // Kutilgan oylik to'lov
      excessAmount: calculatedExcessAmount, // Hisoblangan ortiqcha
      remainingAmount: calculatedRemainingAmount, // Hisoblangan kam to'langan
      targetMonth: payData.targetMonth,
    });

    // ❌ PENDING to'lovlar Contract.payments ga QOSHILMAYDI
    // ✅ Faqat confirmPayment() da qo'shiladi (kassa tasdiqlangandan keyin)
    
    // ❌ nextPaymentDate YANGILANMAYDI
    // ✅ Faqat confirmPayment() da yangilanadi (kassa tasdiqlangandan keyin)
    
    // ❌ Balance yangilanmaydi - faqat kassa tasdiqlanganda
    // ❌ Debtor o'chirilmaydi - faqat kassa tasdiqlanganda
    
    console.log("⏳ Payment created in PENDING status");
    console.log("⏳ Waiting for cash confirmation");
    console.log("⏳ nextPaymentDate will be updated after confirmation");

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

    // ✅ YANGI LOGIKA: Ortiqcha/kam summani hisoblash
    const amountPaid = payData.amount;
    const expectedMonthlyPayment = existingContract.monthlyPayment;

    let calculatedExcessAmount = 0;
    let calculatedRemainingAmount = 0;

    if (amountPaid > expectedMonthlyPayment) {
      calculatedExcessAmount = amountPaid - expectedMonthlyPayment;
    } else if (amountPaid < expectedMonthlyPayment) {
      calculatedRemainingAmount = expectedMonthlyPayment - amountPaid;
    }

    const paymentDoc = await Payment.create({
      amount: payData.amount,
      date: new Date(),
      isPaid: false,
      paymentType: PaymentType.MONTHLY,
      notes: notes._id,
      customerId: customer,
      managerId: manager._id,
      status: PaymentStatus.PENDING, // PENDING - kassaga tushadi
      expectedAmount: expectedMonthlyPayment, // Kutilgan oylik to'lov
      excessAmount: calculatedExcessAmount, // Hisoblangan ortiqcha
      remainingAmount: calculatedRemainingAmount, // Hisoblangan kam to'langan
      targetMonth: payData.targetMonth, // ✅ Yangi: targetMonth'ni saqlash
    });

    // ❌ PENDING to'lovlar Contract.payments ga QOSHILMAYDI
    // ✅ Faqat confirmPayment() da qo'shiladi (kassa tasdiqlangandan keyin)
    
    // ❌ nextPaymentDate YANGILANMAYDI
    // ✅ Faqat confirmPayment() da yangilanadi (kassa tasdiqlangandan keyin)
    
    console.log("⏳ Payment created in PENDING status");
    console.log("⏳ Waiting for cash confirmation");
    console.log("⏳ nextPaymentDate will be updated after confirmation");

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
   * 
   * ✅ MUHIM: Faqat BITTA oy uchun sana o'zgartiriladi
   */
  async postponePayment(
    contractId: string,
    postponeDate: string,
    reason: string,
    user: IJwtUser
  ) {
    console.log("\n" + "=".repeat(60));
    console.log("📅 TO'LOVNI KEYINGA QOLDIRISH (FAQAT BITTA OY)");
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

    // ✅ Eski sanani saqlash (asl to'lov sanasi)
    const oldDate = contract.nextPaymentDate;

    // ✅ Yangi sanani o'rnatish (faqat keyingi oy uchun)
    contract.nextPaymentDate = newDate;

    // ✅ Eski sanani previousPaymentDate ga saqlash
    contract.previousPaymentDate = oldDate;
    contract.postponedAt = new Date();
    contract.isPostponedOnce = true; // ✅ Faqat bitta oy kechiktirilgan

    // ✅ originalPaymentDay ni saqlash (agar mavjud bo'lmasa)
    if (!contract.originalPaymentDay && oldDate) {
      contract.originalPaymentDay = oldDate.getDate();
      console.log("✅ originalPaymentDay saqlandi:", contract.originalPaymentDay);
    }

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
