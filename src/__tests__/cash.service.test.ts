/**
 * Cash Service Unit Tests
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1-2.8, 3.1-3.5, 9.1-9.5
 *
 * MINIMAL TEST - Core functionality only
 */

import cashService from "../dashboard/services/cash.service";
import Payment, { PaymentStatus } from "../schemas/payment.schema";
import paymentService from "../dashboard/services/payment.service";
import IJwtUser from "../types/user";
import { RoleEnum } from "../enums/role.enum";

// Mock user for testing
const mockUser: IJwtUser = {
  sub: "507f1f77bcf86cd799439011",
  name: "Test Kassa User",
  role: RoleEnum.ADMIN,
};

/**
 * Test 1: getPendingPayments should return array
 * Requirements: 1.1, 9.1, 9.2
 */
async function testGetPendingPayments() {
  console.log("\n🧪 TEST 1: getPendingPayments()");

  try {
    const result = await cashService.getPendingPayments();

    // Verify result is an array
    if (!Array.isArray(result)) {
      throw new Error("Result should be an array");
    }

    console.log("✅ PASS: Returns array");
    console.log(`   Found ${result.length} pending payments`);

    // Verify populated fields if payments exist
    if (result.length > 0) {
      const payment = result[0];

      if (!payment.customerId || typeof payment.customerId === "string") {
        throw new Error("customerId should be populated");
      }

      if (!payment.managerId || typeof payment.managerId === "string") {
        throw new Error("managerId should be populated");
      }

      console.log("✅ PASS: Fields are populated correctly");
    }

    return true;
  } catch (error) {
    console.error("❌ FAIL:", (error as Error).message);
    return false;
  }
}

/**
 * Test 2: confirmPayments should handle empty array
 * Requirements: 4.1, 9.3
 */
async function testConfirmPaymentsEmptyArray() {
  console.log("\n🧪 TEST 2: confirmPayments() with empty array");

  try {
    await cashService.confirmPayments([], mockUser);
    console.error("❌ FAIL: Should throw error for empty array");
    return false;
  } catch (error) {
    if ((error as any).message.includes("kiritilmagan")) {
      console.log("✅ PASS: Correctly rejects empty array");
      return true;
    }
    console.error("❌ FAIL: Wrong error message");
    return false;
  }
}

/**
 * Test 3: rejectPayment should validate inputs
 * Requirements: 3.1, 3.2, 9.5
 */
async function testRejectPaymentValidation() {
  console.log("\n🧪 TEST 3: rejectPayment() validation");

  try {
    // Test empty paymentId
    await cashService.rejectPayment("", "Test reason", mockUser);
    console.error("❌ FAIL: Should throw error for empty paymentId");
    return false;
  } catch (error) {
    if ((error as any).message.includes("kiritilmagan")) {
      console.log("✅ PASS: Validates paymentId");
    }
  }

  try {
    // Test empty reason
    await cashService.rejectPayment("507f1f77bcf86cd799439011", "", mockUser);
    console.error("❌ FAIL: Should throw error for empty reason");
    return false;
  } catch (error) {
    if ((error as any).message.includes("sababi")) {
      console.log("✅ PASS: Validates reason");
      return true;
    }
  }

  return false;
}

/**
 * Run all tests
 */
async function runTests() {
  console.log("🚀 Starting Cash Service Tests...");
  console.log("=".repeat(50));

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
  };

  // Test 1
  results.total++;
  if (await testGetPendingPayments()) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Test 2
  results.total++;
  if (await testConfirmPaymentsEmptyArray()) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Test 3
  results.total++;
  if (await testRejectPaymentValidation()) {
    results.passed++;
  } else {
    results.failed++;
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 TEST RESULTS:");
  console.log(`   Total: ${results.total}`);
  console.log(`   ✅ Passed: ${results.passed}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log("=".repeat(50));

  return results.failed === 0;
}

// Export for use in other test files
export {
  runTests,
  testGetPendingPayments,
  testConfirmPaymentsEmptyArray,
  testRejectPaymentValidation,
};
