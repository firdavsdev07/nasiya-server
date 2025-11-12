import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import AuthService from "./dashboard/services/auth.service";
import Employee from "./schemas/employee.schema";
import Auth from "./schemas/auth.schema";
import { Role } from "./schemas/role.schema";
import { RoleEnum } from "./enums/role.enum";
import bcrypt from "bcrypt";

const MONGODB_URI =
  process.env.MONGO_DB || "mongodb://localhost:27017/nasiya_db";

async function setupTestData() {
  let testRole = await Role.findOne({ name: RoleEnum.SELLER });
  if (!testRole) {
    testRole = await Role.create({
      name: RoleEnum.SELLER,
      permissions: [],
    });
  }

  const hashedPassword = await bcrypt.hash("testpassword123", 10);
  const testAuth = await Auth.create({
    password: hashedPassword,
  });

  const testEmployee = await Employee.create({
    firstName: "Test",
    lastName: "User",
    phoneNumber: "+998901234567",
    telegramId: 123456789,
    auth: testAuth._id,
    role: testRole._id,
  });

  const verifyEmployee = await Employee.findById(testEmployee._id).populate(
    "role"
  );
  if (!verifyEmployee || !verifyEmployee.role) {
    throw new Error("Failed to create test employee with role");
  }

  return { testEmployee, testAuth, testRole };
}

async function cleanupTestData(phoneNumber: string) {
  const employee = await Employee.findOne({ phoneNumber });
  if (employee) {
    await Auth.findByIdAndDelete(employee.auth);
    await Employee.findByIdAndDelete(employee._id);
  }
}

async function testIncorrectPassword(phoneNumber: string) {
  try {
    await AuthService.login({
      phoneNumber,
      password: "wrongpassword",
    });
    return false;
  } catch (error: any) {
    return error.message.includes("parol yoki telefon raqam xato");
  }
}

async function testCorrectPassword(phoneNumber: string) {
  try {
    const result = await AuthService.login({
      phoneNumber,
      password: "testpassword123",
    });
    return !!(result.accessToken && result.refreshToken && result.profile);
  } catch (error: any) {
    return false;
  }
}

async function testMultipleIncorrectAttempts(phoneNumber: string) {
  const attempts = 5;

  for (let i = 1; i <= attempts; i++) {
    try {
      await AuthService.login({
        phoneNumber,
        password: `wrongpassword${i}`,
      });
      return false;
    } catch (error: any) {
      if (
        error.message.includes("juda ko`p urinish") ||
        error.message.includes("blocked")
      ) {
        return false;
      }
      if (!error.message.includes("parol yoki telefon raqam xato")) {
        return false;
      }
    }
  }

  try {
    const result = await AuthService.login({
      phoneNumber,
      password: "testpassword123",
    });
    return !!result.accessToken;
  } catch (error: any) {
    return false;
  }
}

async function runTests() {
  try {
    await mongoose.connect(MONGODB_URI);

    const testPhoneNumber = "+998901234567";
    await setupTestData();

    const results = {
      test1: await testIncorrectPassword(testPhoneNumber),
      test2: await testCorrectPassword(testPhoneNumber),
      test3: await testMultipleIncorrectAttempts(testPhoneNumber),
    };

    await cleanupTestData(testPhoneNumber);

    const allPassed = results.test1 && results.test2 && results.test3;

    console.log(
      `Test 1 (Incorrect Password): ${results.test1 ? "PASSED" : "FAILED"}`
    );
    console.log(
      `Test 2 (Correct Password): ${results.test2 ? "PASSED" : "FAILED"}`
    );
    console.log(`Test 3 (No Blocking): ${results.test3 ? "PASSED" : "FAILED"}`);
    console.log(allPassed ? "All tests passed" : "Some tests failed");

    process.exit(allPassed ? 0 : 1);
  } catch (error: any) {
    console.error("Test failed:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
