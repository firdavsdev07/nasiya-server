# Payment Collection Indexing Guide

## Overview

This guide explains the database indexes added to the Payment collection for optimizing the cash system's performance.

## Indexes Added

### 1. Compound Index: isPaid + status

**Name:** `idx_isPaid_status`

**Fields:** `{ isPaid: 1, status: 1 }`

**Purpose:** Optimizes queries that filter by both `isPaid` and `status` fields, specifically the pending payments query.

**Query Optimized:**

```typescript
Payment.find({
  isPaid: false,
  status: PaymentStatus.PENDING,
});
```

### 2. Date Index

**Name:** `idx_date`

**Fields:** `{ date: -1 }`

**Purpose:** Optimizes date-based sorting and queries. The descending order (-1) is optimized for showing newest payments first.

**Query Optimized:**

```typescript
Payment.find({ ... }).sort({ date: -1 })
```

## Performance Impact

### Before Indexes

- **Query Type:** Collection Scan
- **Documents Examined:** All documents in collection
- **Complexity:** O(n) where n = total documents
- **Example:** For 10,000 payments, examines 10,000 documents

### After Indexes

- **Query Type:** Index Scan
- **Documents Examined:** Only matching documents
- **Complexity:** O(log n) + O(k) where k = result set size
- **Example:** For 10,000 payments with 100 pending, examines ~100 documents

### Performance Improvement

For a typical pending payments query:

- **Without indexes:** ~10,000 documents examined
- **With indexes:** ~100 documents examined
- **Improvement:** 100x faster query execution

## Installation

### Method 1: Run Migration (Recommended)

Run all pending migrations:

```bash
npm run migrate:up
```

Run only the indexing migration:

```bash
npx ts-node src/migrations/002-add-payment-indexes.ts
```

### Method 2: Automatic (Schema-based)

Indexes are defined in the Payment schema and will be created automatically when:

- The application starts for the first time
- The schema is modified and reloaded

**Note:** Schema-based index creation happens in the background and may take time for large collections.

## Verification

### Verify Indexes Exist

Run the verification script:

```bash
npm run verify:indexes
```

Or manually:

```bash
npx ts-node scripts/verify-payment-indexes.ts
```

### Check Index Usage

Use MongoDB's explain() to verify index usage:

```javascript
// In MongoDB shell or Compass
db.payments
  .find({
    isPaid: false,
    status: "PENDING",
  })
  .sort({ date: -1 })
  .explain("executionStats");
```

Look for:

- `"stage": "IXSCAN"` (Index Scan) - Good ✅
- `"stage": "COLLSCAN"` (Collection Scan) - Bad ❌

## Rollback

If you need to remove the indexes:

```bash
npm run migrate:down
```

Or manually:

```bash
npx ts-node src/migrations/002-add-payment-indexes.ts down
```

## Monitoring

### Check Index Size

```javascript
// MongoDB shell
db.payments.stats();
```

Look for:

- `totalIndexSize` - Total size of all indexes
- `indexSizes` - Size of each individual index

### Monitor Query Performance

```javascript
// Enable profiling (development only)
db.setProfilingLevel(2);

// Check slow queries
db.system.profile.find({ millis: { $gt: 100 } }).sort({ ts: -1 });
```

## Best Practices

### Do's ✅

- Run migrations during low-traffic periods
- Test on staging environment first
- Verify indexes after deployment
- Monitor query performance after indexing
- Keep indexes in sync with schema definition

### Don'ts ❌

- Don't create too many indexes (impacts write performance)
- Don't create duplicate indexes
- Don't remove indexes without testing
- Don't modify indexes in production without backup

## Troubleshooting

### Index Not Created

**Problem:** Migration runs but index doesn't appear

**Solutions:**

1. Check MongoDB logs for errors
2. Verify sufficient disk space
3. Check user permissions
4. Try creating index manually:
   ```javascript
   db.payments.createIndex(
     { isPaid: 1, status: 1 },
     { name: "idx_isPaid_status", background: true }
   );
   ```

### Slow Query After Indexing

**Problem:** Query still slow after adding indexes

**Solutions:**

1. Verify index is being used (use explain())
2. Check if query matches index fields exactly
3. Ensure index is built completely (check `db.currentOp()`)
4. Consider index selectivity (how many documents match)

### Index Build Blocking

**Problem:** Index creation blocks other operations

**Solutions:**

1. Use `background: true` option (already set in migration)
2. Run during maintenance window
3. Consider using rolling index builds for replica sets

## Related Files

- **Migration:** `src/migrations/002-add-payment-indexes.ts`
- **Schema:** `src/schemas/payment.schema.ts`
- **Verification:** `scripts/verify-payment-indexes.ts`
- **Service:** `src/dashboard/services/cash.service.ts`

## References

- [MongoDB Indexing Strategies](https://docs.mongodb.com/manual/applications/indexes/)
- [Compound Indexes](https://docs.mongodb.com/manual/core/index-compound/)
- [Index Build Process](https://docs.mongodb.com/manual/core/index-creation/)
- [Query Optimization](https://docs.mongodb.com/manual/core/query-optimization/)

## Support

For questions or issues:

1. Check MongoDB logs: `tail -f /var/log/mongodb/mongod.log`
2. Review migration logs: `logs/deploy-*.log`
3. Contact DevOps team

---

**Created:** 2025-01-09  
**Migration:** 002-add-payment-indexes  
**Requirements:** 1.1, 1.5
