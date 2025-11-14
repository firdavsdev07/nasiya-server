import Contract from "../../schemas/contract.schema";
import Customer from "../../schemas/customer.schema";
import Employee from "../../schemas/employee.schema";
import IJwtUser from "../../types/user";

import Payment from "../../schemas/payment.schema";
import { Debtor } from "../../schemas/debtor.schema";
import BaseError from "../../utils/base.error";
import { Types } from "mongoose";

class CustomerService {
  async getAll(user: IJwtUser) {
    const customers = await Customer.find({
      isActive: true,
      isDeleted: false,
      manager: user.sub,
    }).select("firstName lastName _id phoneNumber");

    return {
      status: "success",
      data: customers,
    };
  }

  async getUnpaidDebtors(user: IJwtUser) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = await Debtor.aggregate([
        {
          $lookup: {
            from: "contracts",
            localField: "contractId",
            foreignField: "_id",
            as: "contract",
          },
        },
        { $unwind: "$contract" },

        {
          $lookup: {
            from: "customers",
            localField: "contract.customer",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },

        {
          $match: {
            "customer.manager": new Types.ObjectId(user.sub),
            $or: [
              { payment: { $exists: false } },
              { "payment.isPaid": { $ne: true } },
            ],
          },
        },

        // Kechikish kunlarini hisoblash
        {
          $addFields: {
            delayDays: {
              $cond: [
                { $lt: ["$dueDate", today] },
                {
                  $dateDiff: {
                    startDate: "$dueDate",
                    endDate: today,
                    unit: "day",
                  },
                },
                0,
              ],
            },
          },
        },

        {
          $group: {
            _id: "$customer._id",
            firstName: { $first: "$customer.firstName" },
            lastName: { $first: "$customer.lastName" },
            phoneNumber: { $first: "$customer.phoneNumber" },
            // Eng katta kechikish kunini olish (bir mijozning bir nechta qarzdorligi bo'lishi mumkin)
            delayDays: { $max: "$delayDays" },
          },
        },

        // Kechikish bo'yicha saralash (eng ko'p kechikkanlar birinchi)
        { $sort: { delayDays: -1 } },
      ]);

      return {
        status: "success",
        data: result,
      };
    } catch (error) {
      throw BaseError.InternalServerError(String(error));
    }
  }

  async getPaidDebtors(user: IJwtUser) {
    try {
      const result = await Debtor.aggregate([
        {
          $match: {
            "payment.isPaid": true,
          },
        },
        {
          $lookup: {
            from: "contracts",
            localField: "contractId",
            foreignField: "_id",
            as: "contract",
          },
        },
        { $unwind: "$contract" },
        {
          $lookup: {
            from: "customers",
            localField: "contract.customer",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },
        {
          $match: {
            "customer.manager": new Types.ObjectId(user.sub),
          },
        },
        {
          $group: {
            _id: "$customer._id",
            firstName: { $first: "$customer.firstName" },
            lastName: { $first: "$customer.lastName" },
            phoneNumber: { $first: "$customer.phoneNumber" },
          },
        },
      ]);

      return {
        status: "success",
        data: result,
      };
    } catch (error) {
      throw BaseError.InternalServerError(String(error));
    }
  }

  async getById(user: IJwtUser, customerId: string) {
    try {
      const customerData = await Customer.aggregate([
        {
          $match: {
            _id: new Types.ObjectId(customerId),
            isActive: true,
            isDeleted: false,
            manager: new Types.ObjectId(user.sub),
          },
        },
        {
          $lookup: {
            from: "contracts",
            localField: "_id",
            foreignField: "customer",
            as: "contracts",
          },
        },
        {
          $lookup: {
            from: "payments",
            let: { customerId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$customerId", "$$customerId"] },
                      { $eq: ["$isPaid", true] },
                    ],
                  },
                },
              },
            ],
            as: "payments",
          },
        },
        {
          $addFields: {
            totalDebt: {
              $sum: "$contracts.totalPrice",
            },
            // ✅ TO'G'RI: payments array'da allaqachon initialPayment bor
            totalPaid: {
              $sum: "$payments.amount",
            },
          },
        },
        {
          $addFields: {
            remainingDebt: {
              $subtract: ["$totalDebt", "$totalPaid"],
            },
          },
        },
        // Debtor'larni topish (kechikish kunlari uchun)
        {
          $lookup: {
            from: "debtors",
            let: { contractIds: "$contracts._id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ["$contractId", "$$contractIds"],
                  },
                },
              },
              {
                $match: {
                  $or: [
                    { payment: { $exists: false } },
                    { "payment.isPaid": { $ne: true } },
                  ],
                },
              },
            ],
            as: "debtors",
          },
        },
        // Eng katta kechikish kunini hisoblash
        {
          $addFields: {
            delayDays: {
              $max: {
                $map: {
                  input: "$debtors",
                  as: "debtor",
                  in: {
                    $cond: [
                      { $lt: ["$$debtor.dueDate", new Date()] },
                      {
                        $dateDiff: {
                          startDate: "$$debtor.dueDate",
                          endDate: new Date(),
                          unit: "day",
                        },
                      },
                      0,
                    ],
                  },
                },
              },
            },
          },
        },
        {
          $project: {
            firstName: 1,
            lastName: 1,
            phoneNumber: 1,
            address: 1,
            totalDebt: 1,
            totalPaid: 1,
            remainingDebt: 1,
            delayDays: 1,
          },
        },
      ]);

      if (!customerData.length) {
        throw BaseError.NotFoundError(
          "Mijoz topilmadi yoki sizga tegishli emas"
        );
      }

      return {
        status: "success",
        data: customerData[0],
      };
    } catch (error) {
      throw BaseError.InternalServerError(String(error));
    }
  }

  async getCustomerContracts(customerId: string) {
    console.log("\n🔍 GET CUSTOMER CONTRACTS:", customerId);

    const allContracts = await Contract.aggregate([
      {
        $match: {
          customer: new Types.ObjectId(customerId),
          status: "active",
        },
      },
      {
        $lookup: {
          from: "payments",
          localField: "payments",
          foreignField: "_id",
          as: "paymentDetails",
        },
      },
      {
        $addFields: {
          totalDebt: "$totalPrice",
          // ✅ TO'G'RI: payments array'da allaqachon initialPayment bor
          totalPaid: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$paymentDetails",
                    as: "p",
                    cond: { $eq: ["$$p.isPaid", true] },
                  },
                },
                as: "pp",
                in: "$$pp.amount",
              },
            },
          },
        },
      },
      {
        $addFields: {
          remainingDebt: { $subtract: ["$totalDebt", "$totalPaid"] },
        },
      },
      {
        $project: {
          _id: 1,
          productName: 1,
          totalDebt: 1,
          totalPaid: 1,
          remainingDebt: 1,
          monthlyPayment: 1,
          nextPaymentDate: 1, // ✅ Keyingi to'lov sanasi
          previousPaymentDate: 1, // ✅ Kechiktirilgan eski sana
          postponedAt: 1, // ✅ Qachon kechiktirilgan
          payments: {
            $map: {
              input: {
                $filter: {
                  input: "$paymentDetails",
                  as: "p",
                  cond: { $eq: ["$p.isPaid", true] },
                },
              },
              as: "payment",
              in: {
                amount: "$payment.amount",
                date: "$payment.date",
                isPaid: "$payment.isPaid",
                paymentType: "$payment.paymentType", // ✅ To'lov turini qo'shish
              },
            },
          },
          // ✅ YANGI: To'langan oylar sonini hisoblash
          paidMonthsCount: {
            $size: {
              $filter: {
                input: "$paymentDetails",
                as: "p",
                cond: {
                  $and: [
                    { $eq: ["$p.isPaid", true] },
                    { $ne: ["$p.paymentType", "initial"] },
                  ],
                },
              },
            },
          },
        },
      },
    ]);

    console.log("📋 All Contracts:", allContracts.map(c => ({
      _id: c._id,
      productName: c.productName,
      nextPaymentDate: c.nextPaymentDate,
      nextPaymentDateType: typeof c.nextPaymentDate,
      nextPaymentDateISO: c.nextPaymentDate ? new Date(c.nextPaymentDate).toISOString() : null,
      previousPaymentDate: c.previousPaymentDate,
      postponedAt: c.postponedAt,
      paidMonthsCount: c.paidMonthsCount,  // ✅ Log qo'shish
    })));

    const debtorContractsRaw = await Debtor.aggregate([
      {
        $lookup: {
          from: "contracts",
          localField: "contractId",
          foreignField: "_id",
          as: "contract",
        },
      },
      { $unwind: "$contract" },
      {
        $match: {
          "contract.customer": new Types.ObjectId(customerId),
          "contract.status": "active",
        },
      },
      {
        $lookup: {
          from: "payments",
          localField: "contract.payments",
          foreignField: "_id",
          as: "paymentDetails",
        },
      },
      {
        $addFields: {
          debtorId: "$_id",
          isPaid: {
            $eq: [{ $ifNull: ["$payment.isPaid", false] }, true],
          },
          totalDebt: "$contract.totalPrice",
          // ✅ TO'G'RI: payments array'da allaqachon initialPayment bor
          // Debtor'dagi payment faqat joriy oylik to'lov
          totalPaid: {
            $add: [
              {
                $sum: {
                  $map: {
                    input: {
                      $filter: {
                        input: "$paymentDetails",
                        as: "p",
                        cond: { $eq: ["$$p.isPaid", true] },
                      },
                    },
                    as: "pp",
                    in: "$$pp.amount",
                  },
                },
              },
              { $ifNull: ["$payment.amount", 0] },
            ],
          },
        },
      },
      {
        $addFields: {
          remainingDebt: {
            $subtract: ["$totalDebt", "$totalPaid"],
          },
        },
      },
      {
        $project: {
          _id: "$contract._id",
          productName: "$contract.productName",
          totalDebt: 1,
          totalPaid: 1,
          remainingDebt: 1,
          monthlyPayment: "$contract.monthlyPayment",
          nextPaymentDate: "$contract.nextPaymentDate", // ✅ Keyingi to'lov sanasi
          previousPaymentDate: "$contract.previousPaymentDate", // ✅ Kechiktirilgan eski sana
          postponedAt: "$contract.postponedAt", // ✅ Qachon kechiktirilgan
          debtorId: "$_id",
          isPaid: 1,
          // ✅ YANGI: To'langan oylar sonini hisoblash
          paidMonthsCount: {
            $size: {
              $filter: {
                input: "$paymentDetails",
                as: "p",
                cond: {
                  $and: [
                    { $eq: ["$p.isPaid", true] },
                    { $ne: ["$p.paymentType", "initial"] },
                  ],
                },
              },
            },
          },
        },
      },
    ]);

    console.log("📋 Debtor Contracts:", debtorContractsRaw.map(c => ({
      _id: c._id,
      productName: c.productName,
      nextPaymentDate: c.nextPaymentDate,
      nextPaymentDateType: typeof c.nextPaymentDate,
      nextPaymentDateISO: c.nextPaymentDate ? new Date(c.nextPaymentDate).toISOString() : null,
      previousPaymentDate: c.previousPaymentDate,
      postponedAt: c.postponedAt,
      isPaid: c.isPaid,
      paidMonthsCount: c.paidMonthsCount,  // ✅ Log qo'shish
    })));

    const paidContracts = debtorContractsRaw.filter((c) => c.isPaid === true);
    const debtorContracts = debtorContractsRaw.filter(
      (c) => c.isPaid === false
    );

    console.log("✅ FINAL RESPONSE:", {
      allContractsCount: allContracts.length,
      paidContractsCount: paidContracts.length,
      debtorContractsCount: debtorContracts.length,
    });

    return {
      status: "success",
      data: {
        allContracts,
        paidContracts,
        debtorContracts,
      },
    };
  }
}

export default new CustomerService();
