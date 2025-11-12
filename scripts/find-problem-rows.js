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

console.log("=== MUAMMOLI QATORLARNI TOPISH ===\n");

for (let i = 2; i < data.length; i++) {
  const row = data[i];
  const customer = row[3];
  const product = row[4];
  const startDate = row[0];

  if (!customer) continue;

  // "7/7/25" formatidagi sanalarni topish
  if (startDate && startDate.match(/^7\/7\/\d{2}$/)) {
    console.log(`❌ QATOR ${i}:`);
    console.log(`   Mijoz: ${customer}`);
    console.log(`   Mahsulot: ${product}`);
    console.log(`   Sana: "${startDate}" (MUAMMOLI FORMAT)`);
    console.log(`   Bu "7/7/25" formatida - oy/kun/yil deb o'qilishi mumkin\n`);
  }
}
