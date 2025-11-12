import csv from "csvtojson";
import path from "path";
import Auth from "../../schemas/auth.schema";
import Customer from "../../schemas/customer.schema";
import Payment from "../../schemas/payment.schema";
import Contract, { ContractStatus } from "../../schemas/contract.schema";
import Employee from "../../schemas/employee.schema";
import { Role } from "../../schemas/role.schema";
import { RoleEnum } from "../../enums/role.enum";
import bcrypt from "bcrypt";
import Notes from "../../schemas/notes.schema";

export const importContractsFromCSV = async (filePath: string) => {
  const jsonArray = await csv().fromFile(path.resolve(filePath));
  // const insertedContracts = [];

  const role = await Role.findOne({ name: RoleEnum.MANAGER });
  const roleAdmin = await Role.findOne({ name: RoleEnum.ADMIN });

  const admin = await Employee.findOne({
    role: roleAdmin,
  });

  for (const row of jsonArray) {
    if (!row.period) continue;

    let employee = null;
    if (row.employee) {
      employee = await Employee.findOne({
        firstName: row.employee,
      });

      if (!employee) {
        const hashedPassword = await bcrypt.hash("12345678", 10);

        const auth = new Auth({
          password: hashedPassword,
        });

        employee = await Employee.create({
          firstName: row.employee,
          lastName: "",
          phoneNumber: "",
          telegramId: "",
          auth: auth._id,
          role,
          isActive: true,
        });
      }
    }

    let customer = await Customer.findOne({
      firstName: row.customer,
    });

    if (!customer) {
      const auth = new Auth({});
      await auth.save();

      customer = await Customer.create({
        firstName: row.customer,
        lastName: "",
        phoneNumber: "",
        address: "",
        passportSeries: "",
        birthDate: null,
        percent: 30,
        manager: employee ? employee._id : null,
        auth: auth._id,
        isActive: true,
      });
    }

    const newNotes = await Notes.create({
      text: row.productName,
      customer,
      createBy: admin,
    });

    const percentage = calculateDiscountPercent(row.price, row.totalPrice);

    const contract = await Contract.create({
      customer: customer._id,
      productName: row.productName,
      originalPrice: parseCurrency(row.originalPrice),
      price: parseCurrency(row.price),
      initialPayment: parseCurrency(row.initialPayment),
      percentage,
      period: parseInt(row.period),
      monthlyPayment: parseCurrency(row.monthlyPayment),
      initialPaymentDueDate: parseDate(row.initialPaymentDueDate),
      notes: newNotes,
      totalPrice: parseCurrency(row.totalPrice),
      startDate: parseDate(row.startDate),
      nextPaymentDate: getNextPaymentDateFromPayments(row),
      isActive: employee ? true : false,
      info: normalizeInfoFields(row),
    });

    // paymentlar (01/2023 - 12/2025 ustunlaridan)
    const paymentKeys = Object.keys(row).filter((key) =>
      /\d{2}\/\d{4}/.test(key)
    );

    let totalPaid = parseCurrency(row.initialPayment); // boshlang'ich to'lov

    for (const key of paymentKeys) {
      if (!isValidPaymentAmount(row[key])) continue;

      const value = parseCurrency(row[key]);
      totalPaid += value;

      const payNotes = await Notes.create({
        text: value.toString(),
        customer,
        createBy: admin,
      });

      const payment = await Payment.create({
        amount: value,
        date: parseDateFromColumn(key),
        isPaid: true,
        notes: payNotes,
        customerId: customer._id,
        managerId: employee ? employee._id : admin?._id,
      });

      await Contract.findByIdAndUpdate(contract._id, {
        $push: { payments: payment._id },
      });
    }

    if (totalPaid >= contract.totalPrice) {
      contract.status = ContractStatus.COMPLETED;
      await contract.save();
    }

    // insertedContracts.push(contract);
  }

  return jsonArray;
};

function normalizeInfoFields(row: Record<string, string>) {
  const toBooleanField = (val: string): boolean =>
    val?.trim().toLowerCase() === "bor";

  const normalizeReceipt = (val: string): boolean =>
    val?.trim().toLowerCase() === "true";

  return {
    box: toBooleanField(row.box),
    mbox: toBooleanField(row.mbox),
    receipt: normalizeReceipt(row.receipt),
    iCloud: toBooleanField(row.iCloud),
  };
}

function calculateDiscountPercent(
  priceStr: string,
  totalPriceStr: string
): number {
  const price = parseCurrency(priceStr);
  const totalPrice = parseCurrency(totalPriceStr);

  if (!totalPrice || isNaN(totalPrice) || isNaN(price)) return 0;

  const discount = ((totalPrice - price) * 100) / totalPrice;
  return Math.round(discount * 100) / 100; // 2 xonagacha yaxlitlash
}

const parseCurrency = (value: string): number => {
  if (!value) return 0;

  const cleaned = value.replace(/[^0-9.,]/g, "").trim();

  if (cleaned.includes(".") && cleaned.includes(",")) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  }

  if (cleaned.includes(",") && !cleaned.includes(".")) {
    return parseFloat(cleaned.replace(",", "."));
  }

  if (cleaned.includes(".") && !cleaned.includes(",")) {
    const parts = cleaned.split(".");
    if (parts[1]?.length === 3) {
      return parseFloat(parts.join(""));
    } else {
      return parseFloat(cleaned);
    }
  }

  return parseFloat(cleaned);
};

function isValidPaymentAmount(value: string): boolean {
  if (!value) return false;

  // Naqd yoki $ belgilarini olib tashlash, faqat sonlar, nuqta yoki vergul qoldirish
  const cleaned = value.replace(/[^0-9.,]/g, "").trim();

  // Tozalangandan so‘ng hali ham son bo'lishi kerak
  const number = parseCurrency(cleaned);

  // Quyidagilar valid hisoblanadi:
  // 0, 0.0, 0.00 — hammasi qabul qilinadi
  // 400m, 7mln — son emas bo‘lgani uchun false qaytariladi
  const isPureNumber = /^[0-9]+([.,][0-9]{1,2})?$/.test(cleaned);

  return isPureNumber && !isNaN(number);
}

function getNextPaymentDateFromPayments(
  row: Record<string, string>
): Date | null {
  const paymentKeys = Object.keys(row).filter((key) =>
    /\d{2}\/\d{4}/.test(key)
  );
  const validPayments = paymentKeys
    .filter((key) => isValidPaymentAmount(row[key]))
    .sort((a, b) => {
      const [am, ay] = a.split("/").map(Number);
      const [bm, by] = b.split("/").map(Number);
      return new Date(ay, am - 1).getTime() - new Date(by, bm - 1).getTime();
    });

  if (validPayments.length === 0) return null;

  const [lastMonth, lastYear] = validPayments[validPayments.length - 1]
    .split("/")
    .map(Number);

  // keyingi oy
  const nextMonth = lastMonth === 12 ? 1 : lastMonth + 1;
  const nextYear = lastMonth === 12 ? lastYear + 1 : lastYear;

  return new Date(nextYear, nextMonth - 1, 1);
}

// Sana "DD/MM/YYYY" bo'lsa uni Date ga aylantirish
function parseDate(value: string): Date | null {
  const parts = value?.split("/");
  if (parts?.length === 3) {
    const [day, month, year] = parts.map(Number);
    return new Date(year, month - 1, day);
  }
  return null;
}

// To‘lov ustunlari uchun (masalan "03/2024" → 2024-03-01)
function parseDateFromColumn(monthYear: string): Date {
  const [month, year] = monthYear.split("/").map(Number);
  return new Date(year, month - 1, 1);
}
