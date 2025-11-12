const XLSX = require("xlsx");
const path = require("path");

// Excel faylni o'qish
const filePath = path.join(__dirname, "../../ma'lumot.xlsx");
const workbook = XLSX.readFile(filePath);

// Birinchi sheet'ni olish
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// JSON formatga o'tkazish
const data = XLSX.utils.sheet_to_json(worksheet, {
  header: 1,
  raw: false,
  dateNF: "yyyy-mm-dd",
});

// Ma'lumotlarni ko'rsatish
console.log("=== EXCEL FILE CONTENT ===");
console.log("Sheet name:", sheetName);
console.log("Total rows:", data.length);
console.log("\n=== FIRST 10 ROWS ===");
data.slice(0, 10).forEach((row, index) => {
  console.log(`Row ${index}:`, row);
});

// Ustunlar nomini aniqlash (birinchi qator)
if (data.length > 0) {
  console.log("\n=== COLUMN HEADERS ===");
  console.log(data[0]);
}
