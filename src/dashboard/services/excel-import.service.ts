import XLSX from "xlsx";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import Customer from "../../schemas/customer.schema";
import Contract from "../../schemas/contract.schema";
import Payment, {
  PaymentType,
  PaymentStatus,
} from "../../schemas/payment.schema";
import Notes from "../../schemas/notes.schema";
import Auth from "../../schemas/auth.schema";
import { Balance } from "../../schemas/balance.schema";
import BaseError from "../../utils/base.error";
import { Types } from "mongoose";

dayjs.extend(customParseFormat);

interface ExcelRow {
  startDate: string;
  initialPaymentDueDate: string;
  nextPaymentDate: string;
  customer: string;
  productName: string;
  originalPrice: number;
  price: number;
  initialPayment: number;
  period: number;
  monthlyPayment: number;
  totalPrice: number;
  percentage: number;
  notes?: string;
  box?: string;
  mbox?: string;
  receipt?: string;
  iCloud?: string;
  [key: string]: any; // Oylik to'lovlar uchun
}

class ExcelImportService {
  /**
   * Excel fayldan ma'lumotlarni o'qish
   */
  private readExcelFile(filePath: string): any[] {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // JSON formatga o'tkazish
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      dateNF: "yyyy-mm-dd",
    });

    return data;
  }

  /**
   * Sanani parse qilish (Excel formatidan)
   */
  private parseDate(dateStr: string, isDay: boolean = false): Date {
    if (!dateStr) {
      return new Date();
    }

    // Agar faqat kun raqami bo'lsa (1-31)
    if (isDay && /^\d{1,2}$/.test(dateStr)) {
      const day = parseInt(dateStr);
      if (day >= 1 && day <= 31) {
        // Hozirgi oy va yildan foydalanish
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), day);
      }
    }

    // "5/7/25" yoki "7/7/25" formatini to'g'ri parse qilish
    const shortDateMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (shortDateMatch) {
      let first = parseInt(shortDateMatch[1]);
      let second = parseInt(shortDateMatch[2]);
      let year = parseInt(shortDateMatch[3]);

      // 2-xonali yilni to'g'ri yilga aylantirish
      // Barcha sanalar 2020+ bo'lishi kerak
      year += 2000; // 25 → 2025, 75 → 2075

      // Agar year 2050+ bo'lsa, bu xato - 75 → 2025 bo'lishi kerak
      if (year > 2050) {
        year = 2025; // Default: 2025
        console.warn(`⚠️ Suspicious year in "${dateStr}", using 2025`);
      }

      // Oy va kunni aniqlash
      let month: number, day: number;
      if (first > 12) {
        // kun/oy format: 15/7/25
        day = first;
        month = second;
      } else if (second > 12) {
        // oy/kun format: 7/15/25
        month = first;
        day = second;
      } else {
        // Ikkalasi ham 12 dan kichik - oy/kun
        month = first;
        day = second;
      }

      // Validatsiya
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        console.warn(`⚠️ Invalid date "${dateStr}", using current date`);
        return new Date();
      }

      return new Date(year, month - 1, day);
    }

    // Boshqa formatlar: "2025-05-07" yoki "5/7/2025"
    let parsed = dayjs(dateStr, ["M/D/YYYY", "YYYY-MM-DD", "DD/MM/YYYY"], true);

    if (!parsed.isValid()) {
      // Agar parse bo'lmasa, hozirgi sanani qaytarish
      console.warn(`Invalid date: ${dateStr}, using current date`);
      return new Date();
    }

    return parsed.toDate();
  }

  /**
   * Balance yangilash
   */
  private async updateBalance(
    managerId: Types.ObjectId,
    amount: number
  ): Promise<void> {
    try {
      let balance = await Balance.findOne({ managerId });

      if (!balance) {
        balance = await Balance.create({
          managerId,
          dollar: amount,
          sum: 0,
        });
        console.log(`    💵 Balance created: ${amount}$`);
      } else {
        balance.dollar += amount;
        await balance.save();
        console.log(
          `    💵 Balance updated: +${amount}$ (total: ${balance.dollar}$)`
        );
      }
    } catch (error) {
      console.error("❌ Error updating balance:", error);
      throw error;
    }
  }

  /**
   * Mijoz yaratish yoki topish
   */
  private async findOrCreateCustomer(
    customerName: string,
    managerId: Types.ObjectId
  ): Promise<Types.ObjectId> {
    // Mijoz nomini parse qilish (birinchi so'z - ism, qolganlari - familiya)
    const nameParts = customerName.trim().split(/\s+/);
    const firstName = nameParts[0] || customerName;
    const lastName = nameParts.slice(1).join(" ") || "";

    // Mijozni topish
    let customer = await Customer.findOne({
      firstName: { $regex: new RegExp(`^${firstName}$`, "i") },
      lastName: { $regex: new RegExp(`^${lastName}$`, "i") },
      isDeleted: false,
    });

    if (!customer) {
      // Yangi mijoz yaratish
      const auth = await Auth.create({});

      customer = await Customer.create({
        firstName,
        lastName,
        phoneNumber: "",
        address: "",
        passportSeries: "",
        birthDate: new Date(),
        manager: managerId,
        auth: auth._id,
        isActive: true,
        isDeleted: false,
      });

      console.log(`✅ Created new customer: ${firstName} ${lastName}`);
    } else {
      console.log(`✓ Found existing customer: ${firstName} ${lastName}`);
    }

    return customer._id as Types.ObjectId;
  }

  /**
   * Oylik to'lovlarni parse qilish
   */
  private parseMonthlyPayments(
    row: any[],
    headers: string[],
    startIndex: number
  ): Array<{ month: string; year: number; amount: number }> {
    const payments: Array<{ month: string; year: number; amount: number }> = [];

    for (let i = startIndex; i < headers.length; i++) {
      const header = headers[i];
      const value = row[i];

      // Oy/yil formatini parse qilish: "01/2023"
      const match = header.match(/^(\d{2})\/(\d{4})$/);
      if (!match) continue;

      const month = match[1]; // "01"
      const year = parseInt(match[2]); // 2023

      // Agar to'lov summasi mavjud bo'lsa
      if (value && !isNaN(parseFloat(value))) {
        payments.push({
          month,
          year,
          amount: parseFloat(value),
        });
      }
    }

    return payments;
  }

  /**
   * To'lovlarni yaratish
   * Agar to'lov summasi oylik to'lovdan katta bo'lsa, bir necha oyga bo'lib chiqamiz
   */
  private async createPayments(
    contractId: Types.ObjectId,
    customerId: Types.ObjectId,
    managerId: Types.ObjectId,
    monthlyPayments: Array<{ month: string; year: number; amount: number }>,
    expectedMonthlyPayment: number,
    contractStartDate: Date
  ): Promise<Types.ObjectId[]> {
    const paymentIds: Types.ObjectId[] = [];

    // Shartnoma boshlanish kunini olish (masalan: 7)
    const contractDay = dayjs(contractStartDate).date();

    for (const payment of monthlyPayments) {
      // To'lov sanasini shartnoma boshlanish kuniga moslashtirish
      const paymentDate = dayjs(
        `${payment.year}-${payment.month}-${contractDay}`
      ).toDate();

      // Agar to'lov summasi oylik to'lovdan katta bo'lsa, bir necha oyni to'lagan
      if (payment.amount > expectedMonthlyPayment * 1.5) {
        // Necha oy to'langanini hisoblash
        const monthsCount = Math.floor(payment.amount / expectedMonthlyPayment);
        const remainder = payment.amount - monthsCount * expectedMonthlyPayment;

        console.log(
          `  💰 Large payment detected: ${
            payment.amount
          }$ = ${monthsCount} oy + ${remainder.toFixed(2)}$ qoldiq`
        );

        // Har bir oy uchun alohida to'lov yaratish
        for (let i = 0; i < monthsCount; i++) {
          const currentDate = dayjs(paymentDate).add(i, "month");
          const monthStr = currentDate.format("MM");
          const yearNum = currentDate.year();

          const notes = await Notes.create({
            text: `To'lov: ${monthStr}/${yearNum} - ${expectedMonthlyPayment}$ (${payment.month}/${payment.year} da to'langan)`,
            customer: customerId,
            createBy: managerId,
          });

          const paymentDoc = await Payment.create({
            amount: expectedMonthlyPayment,
            date: currentDate.toDate(),
            isPaid: true,
            paymentType: PaymentType.MONTHLY,
            customerId,
            managerId,
            notes: notes._id,
            status: PaymentStatus.PAID,
            expectedAmount: expectedMonthlyPayment,
            confirmedAt: paymentDate,
            confirmedBy: managerId,
          });

          paymentIds.push(paymentDoc._id);

          console.log(
            `    ✓ Payment ${
              i + 1
            }/${monthsCount}: ${monthStr}/${yearNum} - ${expectedMonthlyPayment}$`
          );
        }

        // Agar qoldiq bo'lsa, alohida to'lov yaratish
        if (remainder > 0.01) {
          const remainderDate = dayjs(paymentDate).add(monthsCount, "month");
          const monthStr = remainderDate.format("MM");
          const yearNum = remainderDate.year();

          const notes = await Notes.create({
            text: `To'lov: ${monthStr}/${yearNum} - ${remainder.toFixed(
              2
            )}$ (qoldiq, ${payment.month}/${payment.year} da to'langan)`,
            customer: customerId,
            createBy: managerId,
          });

          const paymentDoc = await Payment.create({
            amount: remainder,
            date: remainderDate.toDate(),
            isPaid: true,
            paymentType: PaymentType.MONTHLY,
            customerId,
            managerId,
            notes: notes._id,
            status: PaymentStatus.PAID,
            expectedAmount: expectedMonthlyPayment,
            confirmedAt: paymentDate,
            confirmedBy: managerId,
          });

          paymentIds.push(paymentDoc._id);

          console.log(
            `    ✓ Remainder payment: ${monthStr}/${yearNum} - ${remainder.toFixed(
              2
            )}$`
          );
        }
      } else {
        // Oddiy to'lov - bir oy uchun
        const notes = await Notes.create({
          text: `To'lov: ${payment.month}/${payment.year} - ${payment.amount}$`,
          customer: customerId,
          createBy: managerId,
        });

        const paymentDoc = await Payment.create({
          amount: payment.amount,
          date: paymentDate,
          isPaid: true,
          paymentType: PaymentType.MONTHLY,
          customerId,
          managerId,
          notes: notes._id,
          status: PaymentStatus.PAID,
          expectedAmount: expectedMonthlyPayment,
          confirmedAt: paymentDate,
          confirmedBy: managerId,
        });

        paymentIds.push(paymentDoc._id);

        console.log(
          `  ✓ Payment created: ${payment.month}/${payment.year} - ${payment.amount}$`
        );
      }

      // Balance'ni yangilash
      await this.updateBalance(managerId, payment.amount);
    }

    return paymentIds;
  }

  /**
   * Excel fayldan import qilish
   */
  async importFromExcel(
    filePath: string,
    managerId: string
  ): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    console.log("=== EXCEL IMPORT STARTED ===");
    console.log("File:", filePath);
    console.log("Manager ID:", managerId);

    const managerObjectId = new Types.ObjectId(managerId);
    const data = this.readExcelFile(filePath);

    if (data.length < 2) {
      throw BaseError.BadRequest("Excel fayl bo'sh yoki noto'g'ri formatda");
    }

    const headers = data[0] as string[];
    const rows = data.slice(2); // Birinchi 2 qatorni o'tkazib yuborish (header va izoh)

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Oylik to'lovlar boshlanadigan indeksni topish
    const monthlyPaymentsStartIndex = headers.findIndex((h) =>
      /^\d{2}\/\d{4}$/.test(h)
    );

    console.log(`Found ${rows.length} rows to import`);
    console.log(
      `Monthly payments start at column ${monthlyPaymentsStartIndex}`
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as any[];
      const rowNumber = i + 3; // Excel'dagi qator raqami

      try {
        // Bo'sh qatorlarni o'tkazib yuborish
        if (!row[3] || !row[4]) {
          console.log(`Row ${rowNumber}: Skipped (empty)`);
          continue;
        }

        console.log(`\nProcessing row ${rowNumber}: ${row[3]}`);

        // 1. Mijozni yaratish yoki topish
        const customerId = await this.findOrCreateCustomer(
          row[3],
          managerObjectId
        );

        // 2. Shartnoma ma'lumotlarini parse qilish
        const contractData = {
          startDate: this.parseDate(row[0]),
          initialPaymentDueDate: row[1]
            ? this.parseDate(row[1], true)
            : undefined,
          nextPaymentDate: this.parseDate(row[2]),
          customer: customerId,
          productName: row[4] || "Unknown",
          originalPrice: parseFloat(row[5]) || 0,
          price: parseFloat(row[6]) || 0,
          initialPayment: parseFloat(row[7]) || 0,
          period: parseInt(row[8]) || 12,
          monthlyPayment: parseFloat(row[9]) || 0,
          totalPrice: parseFloat(row[10]) || 0,
          percentage: parseFloat(row[11]) || 30,
          notes: row[12] || "",
          box: row[13] === "1" || row[13] === "true",
          mbox: row[14] === "1" || row[14] === "true",
          receipt: row[15] === "1" || row[15] === "true",
          iCloud: row[16] === "1" || row[16] === "true",
        };

        // 3. Notes yaratish
        const notes = await Notes.create({
          text: contractData.notes || "Excel'dan import qilingan",
          customer: customerId,
          createBy: managerObjectId,
        });

        // 4. Shartnoma yaratish
        const contract = await Contract.create({
          customer: customerId,
          productName: contractData.productName,
          originalPrice: contractData.originalPrice,
          price: contractData.price,
          initialPayment: contractData.initialPayment,
          percentage: contractData.percentage,
          period: contractData.period,
          monthlyPayment: contractData.monthlyPayment,
          totalPrice: contractData.totalPrice,
          startDate: contractData.startDate,
          nextPaymentDate: contractData.nextPaymentDate,
          initialPaymentDueDate: contractData.initialPaymentDueDate,
          notes: notes._id,
          status: "active",
          isActive: true,
          isDeleted: false,
          info: {
            box: contractData.box,
            mbox: contractData.mbox,
            receipt: contractData.receipt,
            iCloud: contractData.iCloud,
          },
          payments: [],
          createBy: managerObjectId,
        });

        console.log(`  ✓ Contract created: ${contract._id}`);

        // 5. Oylik to'lovlarni parse qilish va yaratish
        const monthlyPayments = this.parseMonthlyPayments(
          row,
          headers,
          monthlyPaymentsStartIndex
        );

        console.log(`  Found ${monthlyPayments.length} monthly payments`);

        if (monthlyPayments.length > 0) {
          const paymentIds = await this.createPayments(
            contract._id as Types.ObjectId,
            customerId,
            managerObjectId,
            monthlyPayments,
            contractData.monthlyPayment,
            contractData.startDate
          );

          // Contract'ga to'lovlarni qo'shish
          if (!contract.payments) {
            contract.payments = [];
          }
          contract.payments.push(...(paymentIds as any));
          await contract.save();

          console.log(`  ✓ Added ${paymentIds.length} payments to contract`);
        }

        // 6. Boshlang'ich to'lovni yaratish (agar mavjud bo'lsa)
        if (contractData.initialPayment > 0) {
          const initialNotes = await Notes.create({
            text: `Boshlang'ich to'lov: ${contractData.initialPayment}$`,
            customer: customerId,
            createBy: managerObjectId,
          });

          const initialPayment = await Payment.create({
            amount: contractData.initialPayment,
            date: contractData.startDate,
            isPaid: true,
            paymentType: PaymentType.INITIAL,
            customerId,
            managerId: managerObjectId,
            notes: initialNotes._id,
            status: PaymentStatus.PAID,
            confirmedAt: contractData.startDate,
            confirmedBy: managerObjectId,
          });

          contract.payments.push(initialPayment._id as any);
          await contract.save();

          // Balance'ni yangilash
          await this.updateBalance(
            managerObjectId,
            contractData.initialPayment
          );

          console.log(
            `  ✓ Initial payment created: ${contractData.initialPayment}$`
          );
        }

        successCount++;
        console.log(`✅ Row ${rowNumber} imported successfully`);
      } catch (error: any) {
        failedCount++;
        const errorMsg = `Row ${rowNumber}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    console.log("\n=== EXCEL IMPORT COMPLETED ===");
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failedCount}`);

    return {
      success: successCount,
      failed: failedCount,
      errors,
    };
  }
}

export default new ExcelImportService();
