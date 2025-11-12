import "dotenv/config";
import path from "path";
import connectDB from "../src/config/db";
import excelImportService from "../src/dashboard/services/excel-import.service";
import Employee from "../src/schemas/employee.schema";

async function testImport() {
  try {
    console.log("=== EXCEL IMPORT TEST ===\n");

    // 1. Database'ga ulanish
    await connectDB();
    console.log("✅ Connected to database\n");

    // 2. Birinchi employee'ni topish
    const manager = await Employee.findOne({ isDeleted: false });
    if (!manager) {
      throw new Error("Manager topilmadi. Avval employee yarating.");
    }
    console.log(`✅ Found manager: ${manager.firstName} ${manager.lastName}\n`);

    // 3. Excel faylni import qilish
    const excelPath = path.join(__dirname, "../../ma'lumot.xlsx");
    console.log(`📂 Excel file: ${excelPath}\n`);

    const result = await excelImportService.importFromExcel(
      excelPath,
      String(manager._id)
    );

    console.log("\n=== IMPORT RESULTS ===");
    console.log(`✅ Success: ${result.success}`);
    console.log(`❌ Failed: ${result.failed}`);

    if (result.errors.length > 0) {
      console.log("\n=== ERRORS ===");
      result.errors.forEach((error) => {
        console.log(`  - ${error}`);
      });
    }

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ ERROR:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testImport();
