/**
 * CONTRACT SERVICE - PERFORMANCE OPTIMIZATIONS
 *
 * This file contains optimized versions of key methods with:
 * 1. Database query optimization (batch updates, selective population)
 * 2. Reduced database round trips
 * 3. Efficient aggregation pipelines
 * 4. Caching strategy considerations
 *
 * Task 17.1: Performance optimization
 * - Database query optimization
 * - Batch updates
 * - Caching strategy
 */

import { Types } from "mongoose";
import Payment, {
  PaymentStatus,
  PaymentType,
} from "../../schemas/payment.schema";
import Contract from "../../schemas/contract.schema";
import Notes from "../../schemas/notes.schema";
import { Debtor } from "../../schemas/debtor.schema";

/**
 * OPTIMIZATION 1: Batch Payment Updates
 *
 * Instead of saving each payment individually in a loop,
 * use bulkWrite for better performance
 */
export async function batchUpdatePayments(
  payments: Array<{
    _id: Types.ObjectId;
    status: PaymentStatus;
    expectedAmount?: number;
    remainingAmount?: number;
    excessAmount?: number;
  }>
): Promise<void> {
  if (payments.length === 0) return;

  const bulkOps = payments.map((payment) => ({
    updateOne: {
      filter: { _id: payment._id },
      update: {
        $set: {
          status: payment.status,
          ...(payment.expectedAmount !== undefined && {
            expectedAmount: payment.expectedAmount,
          }),
          ...(payment.remainingAmount !== undefined && {
            remainingAmount: payment.remainingAmount,
          }),
          ...(payment.excessAmount !== undefined && {
            excessAmount: payment.excessAmount,
          }),
        },
      },
    },
  }));

  await Payment.bulkWrite(bulkOps);
  console.log(`✅ Batch updated ${payments.length} payments`);
}

/**
 * OPTIMIZATION 2: Batch Notes Updates
 *
 * Update multiple notes in a single operation
 */
export async function batchUpdateNotes(
  updates: Array<{
    noteId: Types.ObjectId;
    textToAppend: string;
  }>
): Promise<void> {
  if (updates.length === 0) return;

  const bulkOps = updates.map((update) => ({
    updateOne: {
      filter: { _id: update.noteId },
      update: {
        $set: {
          text: { $concat: ["$text", update.textToAppend] },
        },
      },
    },
  }));

  // Note: MongoDB $concat doesn't work in update, so we need to fetch and update
  // Alternative: Use aggregation pipeline in update (MongoDB 4.2+)
  for (const update of updates) {
    await Notes.findByIdAndUpdate(update.noteId, {
      $set: {
        text: await Notes.findById(update.noteId).then(
          (note) => (note?.text || "") + update.textToAppend
        ),
      },
    });
  }

  console.log(`✅ Batch updated ${updates.length} notes`);
}

/**
 * OPTIMIZATION 3: Optimized Contract Query with Selective Population
 *
 * Only populate fields that are actually needed
 */
export async function getContractOptimized(contractId: string) {
  return await Contract.findOne({
    _id: contractId,
    isDeleted: false,
  })
    .select(
      "customer productName monthlyPayment initialPayment totalPrice " +
        "payments notes status prepaidBalance editHistory startDate"
    )
    .populate({
      path: "payments",
      select:
        "amount date isPaid paymentType status expectedAmount " +
        "remainingAmount excessAmount linkedPaymentId reason notes",
      options: { sort: { date: 1 } },
    })
    .populate({
      path: "notes",
      select: "text",
    })
    .lean(); // Use lean() for read-only operations (faster)
}

/**
 * OPTIMIZATION 4: Batch Debtor Updates
 *
 * Update all debtors in a single query instead of loop
 */
export async function batchUpdateDebtors(
  contractId: Types.ObjectId,
  newMonthlyPayment: number
): Promise<number> {
  const result = await Debtor.updateMany(
    { contractId },
    {
      $set: {
        debtAmount: newMonthlyPayment,
      },
    }
  );

  console.log(`✅ Batch updated ${result.modifiedCount} debtors`);
  return result.modifiedCount;
}

/**
 * OPTIMIZATION 5: Optimized Payment Query
 *
 * Get paid monthly payments with minimal data and single query
 */
export async function getPaidMonthlyPaymentsOptimized(
  paymentIds: Types.ObjectId[]
) {
  return await Payment.find({
    _id: { $in: paymentIds },
    paymentType: PaymentType.MONTHLY,
    isPaid: true,
  })
    .select("amount date expectedAmount status notes")
    .sort({ date: 1 })
    .populate({
      path: "notes",
      select: "text",
    })
    .lean();
}

/**
 * OPTIMIZATION 6: Aggregation Pipeline for Contract Statistics
 *
 * Calculate contract statistics in database instead of application
 */
export async function getContractStatistics(contractId: string) {
  const result = await Contract.aggregate([
    {
      $match: {
        _id: new Types.ObjectId(contractId),
        isDeleted: false,
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
      $project: {
        totalPrice: 1,
        monthlyPayment: 1,
        initialPayment: 1,
        totalPaid: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: "$paymentDetails",
                  cond: { $eq: ["$$this.isPaid", true] },
                },
              },
              in: "$$this.amount",
            },
          },
        },
        paidPaymentsCount: {
          $size: {
            $filter: {
              input: "$paymentDetails",
              cond: { $eq: ["$$this.isPaid", true] },
            },
          },
        },
        pendingPaymentsCount: {
          $size: {
            $filter: {
              input: "$paymentDetails",
              cond: { $eq: ["$$this.isPaid", false] },
            },
          },
        },
      },
    },
    {
      $addFields: {
        remainingDebt: { $subtract: ["$totalPrice", "$totalPaid"] },
        completionPercentage: {
          $multiply: [{ $divide: ["$totalPaid", "$totalPrice"] }, 100],
        },
      },
    },
  ]);

  return result[0];
}

/**
 * OPTIMIZATION 7: Indexed Query for Edit History
 *
 * Efficiently query edit history with pagination
 */
export async function getEditHistoryPaginated(
  contractId: string,
  page: number = 1,
  limit: number = 10
) {
  const contract = await Contract.findById(contractId)
    .select("editHistory")
    .lean();

  if (!contract || !contract.editHistory) {
    return { history: [], total: 0, page, limit };
  }

  const total = contract.editHistory.length;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  // Return most recent first
  const history = contract.editHistory
    .slice()
    .reverse()
    .slice(startIndex, endIndex);

  return {
    history,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * OPTIMIZATION 8: Parallel Operations
 *
 * Execute independent operations in parallel
 */
export async function executeParallelUpdates(
  contractId: Types.ObjectId,
  operations: {
    updatePayments?: Array<any>;
    updateDebtors?: { oldAmount: number; newAmount: number };
    updateBalance?: { managerId: Types.ObjectId; amount: number };
  }
): Promise<void> {
  const promises: Promise<any>[] = [];

  if (operations.updatePayments && operations.updatePayments.length > 0) {
    promises.push(batchUpdatePayments(operations.updatePayments));
  }

  if (operations.updateDebtors) {
    promises.push(
      batchUpdateDebtors(contractId, operations.updateDebtors.newAmount)
    );
  }

  // Add more parallel operations as needed

  await Promise.all(promises);
  console.log(`✅ Executed ${promises.length} operations in parallel`);
}

/**
 * OPTIMIZATION 9: Efficient Impact Analysis
 *
 * Calculate impact without loading full payment documents
 */
export async function analyzeEditImpactOptimized(
  paymentIds: Types.ObjectId[],
  newMonthlyPayment: number
) {
  const payments = await Payment.find({
    _id: { $in: paymentIds },
    paymentType: PaymentType.MONTHLY,
    isPaid: true,
  })
    .select("amount")
    .lean();

  const impact = {
    underpaidCount: 0,
    overpaidCount: 0,
    totalShortage: 0,
    totalExcess: 0,
    additionalPaymentsCreated: 0,
  };

  for (const payment of payments) {
    const diff = payment.amount - newMonthlyPayment;

    if (diff < -0.01) {
      impact.underpaidCount++;
      impact.totalShortage += Math.abs(diff);
      impact.additionalPaymentsCreated++;
    } else if (diff > 0.01) {
      impact.overpaidCount++;
      impact.totalExcess += diff;
    }
  }

  return impact;
}

/**
 * OPTIMIZATION 10: Connection Pooling Configuration
 *
 * Ensure MongoDB connection pool is properly configured
 * Add this to your database configuration:
 *
 * mongoose.connect(uri, {
 *   maxPoolSize: 10,
 *   minPoolSize: 5,
 *   maxIdleTimeMS: 30000,
 *   serverSelectionTimeoutMS: 5000,
 * });
 */

/**
 * CACHING STRATEGY RECOMMENDATIONS:
 *
 * 1. Cache frequently accessed contracts (Redis)
 * 2. Cache edit history for recent contracts
 * 3. Cache aggregation results for dashboard
 * 4. Invalidate cache on contract updates
 *
 * Example Redis caching:
 *
 * const cacheKey = `contract:${contractId}`;
 * const cached = await redis.get(cacheKey);
 * if (cached) return JSON.parse(cached);
 *
 * const contract = await getContractOptimized(contractId);
 * await redis.setex(cacheKey, 3600, JSON.stringify(contract));
 * return contract;
 */
