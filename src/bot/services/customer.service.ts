import Contract from "../../schemas/contract.schema";
import Customer from "../../schemas/customer.schema";
import IJwtUser from "../../types/user";

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
            delayDays: { $max: "$delayDays" },
          },
        },

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
                      { $eq: ["$customerId", "$customerId"] },
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
        {
          $lookup: {
            from: "debtors",
            let: { contractIds: "$contracts._id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ["$contractId", "$contractIds"],
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
                      { $lt: ["$debtor.dueDate", new Date()] },
                      {
                        $dateDiff: {
                          startDate: "$debtor.dueDate",
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
                        { $eq: ["$$p.status", "PAID"] }
                      ]
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
                        { $eq: ["$$p.status", "PAID"] }
                      ]
                    },
                    { $ne: ["$$p.paymentType", "initial"] },
                    { $ne: ["$$p.paymentType", "extra"] }
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
                            { $eq: ["$$p.status", "PAID"] }
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
          period: "$contract.period",
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
                        { $eq: ["$$p.status", "PAID"] }
                      ]
                    },
                    { $ne: ["$$p.paymentType", "initial"] },
                    { $ne: ["$$p.paymentType", "extra"] }
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
        paymentType: p.paymentType,
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
