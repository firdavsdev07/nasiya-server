/**
 * Verification Script: Check Payment collection indexes
 *
 * This script verifies that the indexes created by migration 002
 * are properly applied to the Payment collection.
 *
 * Usage:
 *   npx ts-node scripts/verify-payment-indexes.ts
 */

import mongoose from "mongoose";
import Payment from "../src/schemas/payment.schema";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function verifyIndexes(): Promise<void> {
  try {
    // Connect to MongoDB
    const mongoUri =
      process.env.MONGO_DB || "mongodb://localhost:27017/nasiya_db";
    console.log("📦 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Get the Payment collection
    const collection = Payment.collection;

    // List all indexes
    console.log("📋 Checking indexes on Payment collection...\n");
    const indexes = await collection.indexes();

    // Display all indexes
    console.log("Current indexes:");
    console.log("================");
    indexes.forEach((index, i) => {
      console.log(`\n${i + 1}. ${index.name}`);
      console.log(`   Keys: ${JSON.stringify(index.key)}`);
      if (index.background !== undefined) {
        console.log(`   Background: ${index.background}`);
      }
      if (index.unique !== undefined) {
        console.log(`   Unique: ${index.unique}`);
      }
    });

    // Verify required indexes exist
    console.log("\n\n🔍 Verifying required indexes...\n");

    const requiredIndexes = [
      { name: "idx_isPaid_status", keys: { isPaid: 1, status: 1 } },
      { name: "idx_date", keys: { date: -1 } },
    ];

    let allIndexesExist = true;

    for (const required of requiredIndexes) {
      const found = indexes.find((idx) => idx.name === required.name);

      if (found) {
        const keysMatch =
          JSON.stringify(found.key) === JSON.stringify(required.keys);
        if (keysMatch) {
          console.log(`✅ ${required.name}: Found and correct`);
        } else {
          console.log(`⚠️  ${required.name}: Found but keys don't match`);
          console.log(`   Expected: ${JSON.stringify(required.keys)}`);
          console.log(`   Actual: ${JSON.stringify(found.key)}`);
          allIndexesExist = false;
        }
      } else {
        console.log(`❌ ${required.name}: Not found`);
        allIndexesExist = false;
      }
    }

    // Get collection stats
    console.log("\n\n📊 Collection Statistics:\n");
    const stats = await collection.stats();
    console.log(`Total documents: ${stats.count}`);
    console.log(`Total indexes: ${stats.nindexes}`);
    console.log(
      `Total index size: ${(stats.totalIndexSize / 1024).toFixed(2)} KB`
    );

    // Summary
    console.log("\n\n" + "=".repeat(50));
    if (allIndexesExist) {
      console.log("🎉 All required indexes are properly configured!");
    } else {
      console.log("⚠️  Some indexes are missing or incorrect.");
      console.log("   Run the migration to create them:");
      console.log("   npm run migrate:up");
    }
    console.log("=".repeat(50) + "\n");

    // Disconnect
    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("❌ Verification failed:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

verifyIndexes();
