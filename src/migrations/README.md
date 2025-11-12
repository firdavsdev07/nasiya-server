# Database Migrations

This directory contains database migration scripts for schema updates.

## Available Migrations

### 001-add-payment-contract-fields.ts

Adds new fields to Payment and Contract schemas for contract edit functionality:

- Payment: `linkedPaymentId`, `reason`, `prepaidAmount`, `appliedToPaymentId`
- Contract: `prepaidBalance`, `editHistory`

### 002-add-payment-indexes.ts

Adds database indexes to Payment schema for performance optimization:

- Compound index on `isPaid` and `status` fields (optimizes pending payments query)
- Index on `date` field (optimizes date-based sorting and queries)

**Performance Impact:** These indexes significantly improve the performance of the cash system's `getPendingPayments` query, reducing query time from O(n) to O(log n) + O(k) where k is the result set size.

## Running Migrations

### Run all migrations

```bash
npm run migrate:up
```

### Rollback migrations

```bash
npm run migrate:down
```

### Run a specific migration directly

```bash
npx ts-node src/migrations/001-add-payment-contract-fields.ts
```

## Adding New Migrations

1. Create a new file with naming convention: `XXX-description.ts`
2. Export `up()` and `down()` functions
3. Add the migration to `run-migration.ts`
4. Test the migration on a development database first

## Migration Structure

```typescript
export async function up(): Promise<void> {
  // Apply changes
}

export async function down(): Promise<void> {
  // Revert changes
}
```

## Environment Variables

Make sure `MONGO_URI` is set in your `.env` file:

```
MONGO_URI=mongodb://localhost:27017/your-database
```

## Best Practices

1. Always test migrations on a backup/development database first
2. Ensure migrations are idempotent (can be run multiple times safely)
3. Write both `up` and `down` functions for every migration
4. Document what each migration does
5. Keep migrations small and focused
6. Never modify existing migration files after they've been run in production
