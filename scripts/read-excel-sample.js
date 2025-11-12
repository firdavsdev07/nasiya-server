const XLSX = require("xlsx");
const path = require("path");

// Excel faylni o'qish
const filePath = path.join(__dirname, "../../version.xlsx");

try {
  // Workbook'ni o'qish
  const workbook = XLSX.readFile(filePath);

  // Birinchi sheet nomini olish
  const sheetName = workbook.SheetNames[0];
  console.log("📄 Sheet nomi:", sheetName);

  // Sheet'ni JSON formatga o'girish
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);

  console.log("\n📊 Jami qatorlar:", jsonData.length);
  console.log("\n📋 Birinchi qator (namuna):");
  console.log(JSON.stringify(jsonData[0], null, 2));

  console.log("\n📋 Barcha ustunlar:");
  if (jsonData.length > 0) {
    console.log(Object.keys(jsonData[0]));
  }

  console.log("\n📋 Barcha ma'lumotlar:");
  console.log(JSON.stringify(jsonData, null, 2));
} catch (error) {
  console.error("❌ Xatolik:", error.message);
}
