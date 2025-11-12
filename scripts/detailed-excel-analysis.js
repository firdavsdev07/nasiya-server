const XLSX = require("xlsx");
const path = require("path");

const filePath = path.join(__dirname, "../../ma'lumot.xlsx");
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const data = XLSX.utils.sheet_to_json(worksheet, {
  header: 1,
  raw: false,
  dateNF: "yyyy-mm-dd",
});

const headers = data[0];

console.log("=== OYLIK TO'LOVLAR USTUNLARI TAHLILI ===\n");

// Har bir oylik ustun uchun ma'lumot borligini tekshirish
const monthlyColumns = [];
for (let i = 17; i < headers.length; i++) {
  const header = headers[i];
  let hasData = false;
  let totalAmount = 0;
  let paymentCount = 0;

  // Barcha qatorlarni tekshirish
  for (let j = 2; j < data.length; j++) {
    const row = data[j];
    if (row[i] && !isNaN(parseFloat(row[i]))) {
      hasData = true;
      totalAmount += parseFloat(row[i]);
      paymentCount++;
    }
  }

  monthlyColumns.push({
    index: i,
    header: header,
    hasData: hasData,
    paymentCount: paymentCount,
    totalAmount: totalAmount,
  });
}

// Bo'sh va to'ldirilgan ustunlarni ajratish
const emptyColumns = monthlyColumns.filter((col) => !col.hasData);
const filledColumns = monthlyColumns.filter((col) => col.hasData);

console.log(`📊 JAMI OYLIK USTUNLAR: ${monthlyColumns.length}`);
console.log(`✅ TO'LDIRILGAN: ${filledColumns.length}`);
console.log(`❌ BO'SH: ${emptyColumns.length}\n`);

console.log("❌ BO'SH USTUNLAR (ma'lumot yo'q):");
emptyColumns.forEach((col) => {
  console.log(`   [${col.index}] ${col.header}`);
});

console.log("\n✅ TO'LDIRILGAN USTUNLAR (ma'lumot bor):");
filledColumns.forEach((col) => {
  console.log(
    `   [${col.index}] ${col.header} - ${
      col.paymentCount
    } ta to'lov, jami: ${col.totalAmount.toFixed(2)}$`
  );
});

// Birinchi mijozni batafsil ko'rsatish
console.log("\n\n📋 BIRINCHI MIJOZ (UMIDA) - BATAFSIL:");
const row2 = data[2];
console.log("Mijoz:", row2[3]);
console.log("Mahsulot:", row2[4]);
console.log("\nBarcha ustunlar:");
for (let i = 17; i < headers.length; i++) {
  const value = row2[i];
  const status = value && !isNaN(parseFloat(value)) ? "✅" : "❌";
  console.log(`  ${status} [${i}] ${headers[i]}: ${value || "(bo'sh)"}`);
}
