import Contract from "../../schemas/contract.schema";
import Customer from "../../schemas/customer.schema";
import IJwtUser from "../../types/user";

import { Debtor } from "../../schemas/debtor.schema";
import BaseError from "../../utils/base.error";
import { Types } from "mongoose";

class CustomerService {
  async getAll(user: IJwtUser) {
    console.log("\n👥 === GETTING ALL CUSTOMERS ===");
    console.log("👤 Manager ID:", user.sub);

    // Debug: Barcha mijozlarni sanash
    const totalCustomers = await Customer.countDocuments({
      isActive: true,
      isDeleted: false,
    });
    console.log("📊 Total active customers:", totalCustomers);

    const managerCustomers = await Customer.countDocuments({
      isActive: true,
      isDeleted: false,
      manager: user.sub,
    });
    console.log("📊 Manager's customers:", managerCustomers);

    const customers = await Customer.find({
      isActive: true,
      isDeleted: false,
      manager: user.sub,
    }).select("firstName lastName _id phoneNumber");

    console.log(`✅ Found ${customers.length} customers for manager`);

    if (customers.length > 0) {
      console.log("📋 Sample customer:", {
        firstName: customers[0].firstName,
        lastName: customers[0].lastName,
        phoneNumber: customers[0].phoneNumber,
      });
    }
    console.log("=".repeat(50) + "\n");

    return {
      status: "success",
      data: customers,
    };
  }

  async getUnpaidDebtors(user: IJwtUser) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      console.log("\n🔍 === GETTING UNPAID DEBTORS ===");
      console.log("👤 Manager ID:", user.sub);
      console.log("📅 Today:", today.toISOString().split("T")[0]);

      // Debug: Barcha shartnomalarni sanash
      const totalContracts = await Contract.countDocuments({
        isActive: true,
        isDeleted: false,
        status: "active",
      });
      console.log("📊 Total active contracts:", totalContracts);

      const overdueContracts = await Contract.countDocuments({
        isActive: true,
        isDeleted: false,
        status: "active",
        nextPaymentDate: { $lt: today },
      });
      console.log("⏰ Overdue contracts:", overdueContracts);

      // To'g'ridan-to'g'ri Contract'lardan kechikkan to'lovlarni olish
      const result = await Contract.aggregate([
        {
          $match: {
            isActive: true,
            isDeleted: false,
            status: "active", // ✅ TUZATILDI: kichik harflar bilan
            nextPaymentDate: { $lt: today }, // Kechikkan to'lovlar
          },
        },
        {
          $lookup: {
            from: "customers",
            localField: "customer",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },
        {
          $match: {
            "customer.manager": new Types.ObjectId(user.sub),
            "customer.isActive": true,
            "customer.isDeleted": false,
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
            remainingDebt: {
              $subtract: ["$totalPrice", "$totalPaid"],
            },
          },
        },
        // Faqat qarzi bor shartnomalar
        {
          $match: {
            remainingDebt: { $gt: 0 },
          },
        },
        // Kechikish kunlarini hisoblash (MongoDB 4.x uchun ham ishlaydi)
        {
          $addFields: {
            delayDays: {
              $floor: {
                $divide: [
                  { $subtract: [today, "$nextPaymentDate"] },
                  1000 * 60 * 60 * 24, // milliseconds to days
                ],
              },
            },
          },
        },
        {
          $group: {
            _id: "$customer._id",
            firstName: { $first: "$customer.firstName" },
            lastName: { $first: "$customer.lastName" },
            phoneNumber: { $first: "$customer.phoneNumber" },
            delayDays: { $max: "$delayDays" },
            totalDebt: { $sum: "$remainingDebt" },
            contractsCount: { $sum: 1 },
          },
        },
        { $sort: { delayDays: -1 } },
      ]);

      console.log(`✅ Found ${result.length} customers with overdue payments`);

      if (result.length > 0) {
        console.log("📋 Sample debtor:", {
          firstName: result[0].firstName,
          lastName: result[0].lastName,
          delayDays: result[0].delayDays,
          totalDebt: result[0].totalDebt,
          contractsCount: result[0].contractsCount,
        });
      }
      console.log("=".repeat(50) + "\n");

      return {
        status: "success",
        data: result,
      };
    } catch (error) {
      console.error("❌ Error getting unpaid debtors:", error);
      throw BaseError.InternalServerError(String(error));
    }
  }

  async getPaidDebtors(user: IJwtUser) {
    try {
      console.log("\n💰 === GETTING CUSTOMERS WITH PAYMENTS ===");
      console.log("👤 Manager ID:", user.sub);

      // Oxirgi 30 kun ichida to'lov qilgan mijozlarni olish
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      console.log("📅 Looking for payments since:", thirtyDaysAgo.toISOString().split("T")[0]);

      // Payment collection'dan to'lov qilgan mijozlarni topish
      const result = await Contract.aggregate([
        {
          $match: {
            isActive: true,
            isDeleted: false,
            status: "active",
          },
        },
        {
          $lookup: {
            from: "customers",
            localField: "customer",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },
        {
          $match: {
            "customer.manager": new Types.ObjectId(user.sub),
            "customer.isActive": true,
            "customer.isDeleted": false,
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
        // Faqat oxirgi 30 kun ichida to'lov qilgan shartnomalar
        {
          $addFields: {
            recentPayments: {
              $filter: {
                input: "$paymentDetails",
                as: "p",
                cond: {
                  $and: [
                    { $eq: ["$$p.isPaid", true] },
                    { $gte: ["$$p.date", thirtyDaysAgo] },
                  ],
                },
              },
            },
          },
        },
        {
          $match: {
            "recentPayments.0": { $exists: true }, // Kamida 1 ta to'lov bo'lishi kerak
          },
        },
        {
          $addFields: {
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
            lastPaymentDate: {
              $max: {
                $map: {
                  input: "$recentPayments",
                  as: "p",
                  in: "$$p.date",
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
        // Mijozlar bo'yicha guruhlash
        {
          $group: {
            _id: "$customer._id",
            firstName: { $first: "$customer.firstName" },
            lastName: { $first: "$customer.lastName" },
            phoneNumber: { $first: "$customer.phoneNumber" },
            lastPaymentDate: { $max: "$lastPaymentDate" },
            totalPaid: { $sum: "$totalPaid" },
            totalDebt: { $sum: "$totalPrice" },
            remainingDebt: { $sum: "$remainingDebt" },
            contractsCount: { $sum: 1 },
          },
        },
        { $sort: { lastPaymentDate: -1 } }, // Eng oxirgi to'lov qilganlar birinchi
      ]);

      console.log(`✅ Found ${result.length} customers with recent payments`);

      if (result.length > 0) {
        console.log("📋 Sample customer:", {
          firstName: result[0].firstName,
          lastName: result[0].lastName,
          lastPaymentDate: result[0].lastPaymentDate,
          totalPaid: result[0].totalPaid,
          remainingDebt: result[0].remainingDebt,
        });
      }
      console.log("=".repeat(50) + "\n");

      return {
        status: "success",
        data: result,
      };
    } catch (error) {
      console.error("❌ Error getting customers with payments:", error);
      throw BaseError.InternalServerError(String(error));
    }
  }

  async getById(user: IJwtUser, customerId: string) {
    try {
      console.log("\n🔍 === GET CUSTOMER BY ID ===");
      console.log("📋 Customer ID:", customerId);
      console.log("👤 Manager ID:", user.sub);

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
                      { $eq: ["$customerId", "$$customerId"] }, // ✅ TUZATILDI: $$ ishlatildi
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
            totalPaid: {
              $sum: {
                $map: {
                  input: "$payments",
                  as: "payment",
                  in: "$$payment.amount", // ✅ TUZATILDI: to'g'ri format
                },
              },
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
          $lookup: {
            from: "debtors",
            let: { contractIds: "$contracts._id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ["$contractId", "$$contractIds"], // ✅ TUZATILDI: $$ ishlatildi
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
        {
          $addFields: {
            delayDays: {
              $max: {
                $map: {
                  input: "$debtors",
                  as: "debtor",
                  in: {
                    $cond: [
                      { $lt: ["$$debtor.dueDate", new Date()] }, // ✅ TUZATILDI: $$ ishlatildi
                      {
                        $dateDiff: {
                          startDate: "$$debtor.dueDate", // ✅ TUZATILDI: $$ ishlatildi
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

      console.log("📊 Customer data found:", customerData.length);

      if (!customerData.length) {
        console.log("❌ Customer not found or not accessible");
        throw BaseError.NotFoundError(
          "Mijoz topilmadi yoki sizga tegishli emas"
        );
      }

      console.log("✅ Customer details:", {
        firstName: customerData[0].firstName,
        lastName: customerData[0].lastName,
        phoneNumber: customerData[0].phoneNumber,
        totalDebt: customerData[0].totalDebt,
        totalPaid: customerData[0].totalPaid,
        remainingDebt: customerData[0].remainingDebt,
      });
      console.log("=".repeat(50) + "\n");

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
          status: "active", // ✅ To'g'ri - kichik harflar
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
          totalPaid: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$paymentDetails",
                    as: "p",
                    cond: {
                      $or: [
                        { $eq: ["$$p.isPaid", true] },
                        { $eq: ["$$p.status", "PAID"] },
                        { $eq: ["$$p.status", "PENDING"] }, // ✅ PENDING to'lovlarni ham hisobga olish
                      ],
                    },
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
          startDate: 1,
          initialPayment: 1,
          initialPaymentDueDate: 1,
          period: 1,
          nextPaymentDate: 1,
          previousPaymentDate: 1,
          postponedAt: 1,
          isPostponedOnce: 1,
          originalPaymentDay: 1,
          payments: {
            $map: {
              input: "$paymentDetails",
              as: "payment",
              in: {
                _id: "$$payment._id",
                amount: "$$payment.amount",
                actualAmount: "$$payment.actualAmount",
                date: "$$payment.date",
                isPaid: "$$payment.isPaid",
                paymentType: "$$payment.paymentType",
                status: "$$payment.status",
                remainingAmount: "$$payment.remainingAmount",
                excessAmount: "$$payment.excessAmount",
                expectedAmount: "$$payment.expectedAmount",
                targetMonth: "$$payment.targetMonth", // ✅ Add targetMonth
              },
            },
          },
          paidMonthsCount: {
            $size: {
              $filter: {
                input: "$paymentDetails",
                as: "p",
                cond: {
                  $and: [
                    {
                      $or: [
                        { $eq: ["$$p.isPaid", true] },
                        { $eq: ["$$p.status", "PAID"] },
                        { $eq: ["$$p.status", "PENDING"] } // ✅ PENDING to'lovlarni ham hisobga olish
                      ]
                    },
                    { $eq: ["$$p.paymentType", "monthly"] }
                  ],
                },
              },
            },
          },
          durationMonths: "$period",
        },
      },
    ]);

    console.log("📋 All Contracts COUNT:", allContracts.length);

    if (allContracts.length > 0) {
      console.log("📋 First Contract Details:", {
        _id: allContracts[0]._id,
        productName: allContracts[0].productName,
        initialPayment: allContracts[0].initialPayment,
        initialPaymentDueDate: allContracts[0].initialPaymentDueDate,
        monthlyPayment: allContracts[0].monthlyPayment,
        period: allContracts[0].period,
        paidMonthsCount: allContracts[0].paidMonthsCount,
        durationMonths: allContracts[0].durationMonths,
        paymentsCount: allContracts[0].payments?.length || 0,
        paymentsIsNull: allContracts[0].payments === null,
        paymentsIsUndefined: allContracts[0].payments === undefined,
      });

      console.log("📋 Payments Array:", allContracts[0].payments?.map((p: any) => ({
        _id: p._id,
        paymentType: p.paymentType,
        isPaid: p.isPaid,
        status: p.status,
        amount: p.amount,
        date: p.date,
      })));
    }

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
          totalPaid: {
            $add: [
              {
                $sum: {
                  $map: {
                    input: {
                      $filter: {
                        input: "$paymentDetails",
                        as: "p",
                        cond: {
                          $or: [
                            { $eq: ["$$p.isPaid", true] },
                            { $eq: ["$$p.status", "PAID"] },
                            { $eq: ["$$p.status", "PENDING"] } // ✅ PENDING to'lovlarni ham hisobga olish
                          ]
                        },
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
          startDate: "$contract.startDate",
          initialPayment: "$contract.initialPayment",
          initialPaymentDueDate: "$contract.initialPaymentDueDate",
          period: 1,
          nextPaymentDate: "$contract.nextPaymentDate",
          previousPaymentDate: "$contract.previousPaymentDate",
          postponedAt: "$contract.postponedAt",
          debtorId: "$_id",
          isPaid: 1,
          paidMonthsCount: {
            $size: {
              $filter: {
                input: "$paymentDetails",
                as: "p",
                cond: {
                  $and: [
                    {
                      $or: [
                        { $eq: ["$$p.isPaid", true] },
                        { $eq: ["$$p.status", "PAID"] }, // Corrected: removed extra $
                        { $eq: ["$$p.status", "PENDING"] } // ✅ PENDING to'lovlarni ham hisobga olish
                      ]
                    },
                    { $eq: ["$$p.paymentType", "monthly"] }
                  ],
                },
              },
            },
          },
          durationMonths: "$contract.period",
          payments: {
            $map: {
              input: "$paymentDetails",
              as: "payment",
              in: {
                _id: "$$payment._id",
                amount: "$$payment.amount",
                actualAmount: "$$payment.actualAmount",
                date: "$$payment.date",
                isPaid: "$$payment.isPaid",
                paymentType: "$$payment.paymentType",
                status: "$$payment.status",
                remainingAmount: "$$payment.remainingAmount",
                excessAmount: "$$payment.excessAmount",
                expectedAmount: "$$payment.expectedAmount",
                targetMonth: "$$payment.targetMonth", // ✅ Add targetMonth
              },
            },
          },
        },
      },
    ]);

    console.log("📋 Debtor Contracts:", debtorContractsRaw.map(c => ({
      _id: c._id,
      productName: c.productName,
      paidMonthsCount: c.paidMonthsCount,
      durationMonths: c.durationMonths,
      paymentsCount: c.payments?.length || 0,
      payments: c.payments?.map((p: any) => ({
        paymentType: p.type, // Make sure this is correct
        isPaid: p.isPaid,
        amount: p.amount,
      })),
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

    // ✅ Ma'lumotlar null yoki undefined emasligini tekshirish
    const response = {
      status: "success",
      data: {
        allContracts: allContracts || [],
        paidContracts: paidContracts || [],
        debtorContracts: debtorContracts || [],
      },
    };

    console.log("📤 SENDING RESPONSE:", {
      hasAllContracts: !!response.data.allContracts,
      allContractsLength: response.data.allContracts.length,
      firstContract: response.data.allContracts[0] ? {
        _id: response.data.allContracts[0]._id,
        paidMonthsCount: response.data.allContracts[0].paidMonthsCount,
        durationMonths: response.data.allContracts[0].durationMonths,
        paymentsCount: response.data.allContracts[0].payments?.length,
      } : null,
    });

    return response;
  }
}

export default new CustomerService();