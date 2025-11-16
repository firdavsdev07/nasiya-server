import "dotenv/config";
import XLSX from "xlsx";

async function analyzeExcelStructure() {
  try {
    console.log("=== EXCEL STRUCTURE ANALYSIS ===\n");

    const filePath = "./ma'lumot.xlsx";
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // JSON formatga o'tkazish
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      dateNF: "yyyy-mm-dd",
    });

    console.log("📊 UMUMIY MA'LUMOT:");
    console.log(`  Sheet nomi: ${sheetName}`);
    console.log(`  Jami qatorlar: ${data.length}`);
    console.log(`  Jami ustunlar: ${(data[0] as any[]).length}\n`);

    // USTUNLAR (COLUMNS)
    console.log("📋 USTUNLAR (COLUMNS):");
    const headers = data[0] as string[];

    // Shartnoma ma'lumotlari ustunlari (0-16)
    console.log("\n  1️⃣ SHARTNOMA MA'LUMOTLARI (0-16):");
    headers.slice(0, 17).forEach((header, index) => {
      console.log(`     [${index}] ${header}`);
    });

    // Oylik to'lovlar ustunlari (17+)
    console.log("\n  2️⃣ OYLIK TO'LOVLAR (17+):");
    const monthlyColumns = headers.slice(17);
    console.log(`     Jami oylik ustunlar: ${monthlyColumns.length}`);
    console.log(`     Birinchi 5 ta: ${monthlyColumns.slice(0, 5).join(", ")}`);
    console.log(`     Oxirgi 5 ta: ${monthlyColumns.slice(-5).join(", ")}`);

    // QATORLAR (ROWS)
    console.log("\n\n📋 QATORLAR (ROWS):");
    console.log(`  Qator 0: USTUNLAR NOMI (headers)`);
    console.log(`  Qator 1: IZOHLAR (o'tkazib yuboriladi)`);
    console.log(`  Qator 2+: MA'LUMOTLAR (mijozlar va shartnomalar)\n`);

    // Birinchi 3 ta ma'lumot qatorini ko'rsatish
    console.log("  📊 BIRINCHI 3 TA MIJOZ:\n");

    for (let i = 2; i <= 4; i++) {
      const row = data[i] as any[];
      if (!row || !row[3]) continue;

      console.log(`  ━━━ QATOR ${i} ━━━`);
      console.log(`  👤 Mijoz: ${row[3]}`);
      console.log(`  📱 Mahsulot: ${row[4]}`);
      console.log(`  📅 Boshlanish: ${row[0]}`);
      console.log(`  💰 Oylik to'lov: ${row[9]}$`);
      console.log(`  📆 Muddat: ${row[8]} oy`);

      // Oylik to'lovlarni sanash
      let paidMonths = 0;
      let totalPaid = 0;
      const paidMonthsList: string[] = [];

      for (let j = 17; j < row.length; j++) {
        if (row[j] && !isNaN(parseFloat(row[j]))) {
          paidMonths++;
          totalPaid += parseFloat(row[j]);
          paidMonthsList.push(`${headers[j]}=${row[j]}$`);
        }
      }

      console.log(`  ✅ To'langan oylar: ${paidMonths} ta`);
      console.log(`  💵 Jami to'langan: ${totalPaid}$`);
      if (paidMonthsList.length > 0) {
        console.log(`  📝 To'lovlar:`);
        paidMonthsList.forEach((payment) => {
          console.log(`     - ${payment}`);
        });
      }
      console.log("");
    }

    // STATISTIKA
    console.log("\n📊 STATISTIKA:");
    let totalCustomers = 0;
    let totalPayments = 0;
    let totalAmount = 0;

    for (let i = 2; i < data.length; i++) {
      const row = data[i] as any[];
      if (!row || !row[3]) continue;

      totalCustomers++;

      for (let j = 17; j < row.length; j++) {
        if (row[j] && !isNaN(parseFloat(row[j]))) {
          totalPayments++;
          totalAmount += parseFloat(row[j]);
        }
      }
    }

    console.log(`  👥 Jami mijozlar: ${totalCustomers}`);
    console.log(`  💰 Jami to'lovlar: ${totalPayments} ta`);
    console.log(`  💵 Jami summa: ${totalAmount.toFixed(2)}$`);

    // IMPORT JARAYONI
    console.log("\n\n🔄 IMPORT JARAYONI:");
    console.log("  1️⃣ Excel faylni o'qish");
    console.log("  2️⃣ Ustunlar nomini olish (qator 0)");
    console.log("  3️⃣ Izohlarni o'tkazib yuborish (qator 1)");
    console.log("  4️⃣ Har bir qator uchun (qator 2+):");
    console.log("     a) Mijoz ma'lumotlarini parse qilish (ustun 0-16)");
    console.log("     b) Mijozni yaratish/topish");
    console.log("     c) Shartnoma yaratish");
    console.log("     d) Oylik to'lovlarni parse qilish (ustun 17+)");
    console.log("     e) Har bir to'langan oy uchun Payment yaratish");
    console.log("     f) Balance'ni yangilash");
    console.log("     g) Contract'ga to'lovlarni qo'shish");

    console.log("\n✅ Tahlil yakunlandi!");
  } catch (error: any) {
    console.error("\n❌ ERROR:", error.message);
  }
}

analyzeExcelStructure();
