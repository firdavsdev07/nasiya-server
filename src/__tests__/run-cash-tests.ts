/**
 * Test Runner for Cash System
 * Runs all backend tests for the cash system
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { runTests as runServiceTests } from "./cash.service.test";
import { runTests as runControllerTests } from "./cash.controller.test";

// Load environment variables
dotenv.config();

/**
 * Connect to database
 */
async function connectDB() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/test";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
}

/**
 * Disconnect from database
 */
async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ MongoDB disconnection error:", error);
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log("\n");
  console.log("╔" + "═".repeat(58) + "╗");
  console.log(
    "║" + " ".repeat(10) + "KASSA TIZIMI - BACKEND TESTS" + " ".repeat(20) + "║"
  );
  console.log("╚" + "═".repeat(58) + "╝");
  console.log("\n");

  let allTestsPassed = true;

  try {
    // Connect to database
    await connectDB();

    // Run service tests
    console.log("\n📦 CASH SERVICE TESTS");
    console.log("─".repeat(60));
    const serviceTestsPassed = await runServiceTests();
    if (!serviceTestsPassed) {
      allTestsPassed = false;
    }

    // Run controller tests
    console.log("\n🎮 CASH CONTROLLER TESTS");
    console.log("─".repeat(60));
    const controllerTestsPassed = await runControllerTests();
    if (!controllerTestsPassed) {
      allTestsPassed = false;
    }

    // Final summary
    console.log("\n");
    console.log("╔" + "═".repeat(58) + "╗");
    if (allTestsPassed) {
      console.log(
        "║" + " ".repeat(15) + "✅ ALL TESTS PASSED" + " ".repeat(24) + "║"
      );
    } else {
      console.log(
        "║" + " ".repeat(15) + "❌ SOME TESTS FAILED" + " ".repeat(22) + "║"
      );
    }
    console.log("╚" + "═".repeat(58) + "╝");
    console.log("\n");
  } catch (error) {
    console.error("\n❌ Test execution error:", error);
    allTestsPassed = false;
  } finally {
    // Disconnect from database
    await disconnectDB();
  }

  // Exit with appropriate code
  process.exit(allTestsPassed ? 0 : 1);
}

// Run tests
main();
