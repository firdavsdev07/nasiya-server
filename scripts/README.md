# Deployment Scripts

This directory contains automated deployment and monitoring scripts for the application.

## Scripts Overview

### 🚀 deploy-staging.sh

Automated staging deployment script with:

- Pre-deployment validation
- Database backup
- Migration execution
- Smoke tests
- UAT preparation

**Usage:**

```bash
./scripts/deploy-staging.sh
# or
npm run deploy:staging
```

### 🚀 deploy-production.sh

Production deployment script with:

- Comprehensive validation
- Zero-downtime deployment
- Automated backup
- Health checks
- Monitoring setup
- Automatic rollback on failure

**Usage:**

```bash
./scripts/deploy-production.sh
# or
npm run deploy:production
```

### 🔙 rollback-production.sh

Emergency rollback script for production:

- Database restoration
- Migration rollback
- Application restart
- Health verification

**Usage:**

```bash
./scripts/rollback-production.sh
# or
npm run rollback:production
```

### 📊 monitor-production.sh

Continuous production monitoring:

- Health checks
- Resource monitoring
- Error tracking
- Automated alerts

**Usage:**

```bash
./scripts/monitor-production.sh
# or
npm run monitor:production
```

## Prerequisites

### Required Tools

- bash shell
- Node.js 18+
- MongoDB 6+
- MongoDB Database Tools (mongodump, mongorestore)
- PM2 (process manager)
- jq (JSON processor)
- curl

### Installation

```bash
# MongoDB tools
sudo apt-get install mongodb-database-tools  # Ubuntu/Debian
brew install mongodb-database-tools          # macOS

# PM2
npm install -g pm2

# jq
sudo apt-get install jq  # Ubuntu/Debian
brew install jq          # macOS
```

## Environment Setup

### Staging

```bash
cp .env.staging.example .env.staging
# Edit .env.staging with your values
```

### Production

```bash
cp .env.production.example .env.production
# Edit .env.production with your values
```

## Quick Start

### First Time Setup

1. Make scripts executable:

```bash
chmod +x scripts/*.sh
```

2. Configure environments:

```bash
# Edit staging environment
nano .env.staging

# Edit production environment
nano .env.production
```

3. Test on staging:

```bash
npm run deploy:staging
```

4. Perform UAT testing

5. Deploy to production:

```bash
npm run deploy:production
```

## Script Features

### deploy-staging.sh

**Pre-deployment Checks:**

- Environment file validation
- MongoDB connection test
- Build verification
- Disk space check

**Deployment Steps:**

1. Create database backup
2. Run migrations
3. Deploy application
4. Run smoke tests
5. Generate UAT checklist
6. Create test data script

**Output:**

- Deployment log: `logs/deploy-staging-*.log`
- UAT checklist: `logs/uat-checklist-*.md`
- Test data script: `scripts/generate-test-data.js`

### deploy-production.sh

**Pre-deployment Validation:**

- Environment verification
- Staging deployment check
- Database connectivity
- System resources
- Build verification

**Deployment Steps:**

1. Confirmation prompt
2. Backup current application
3. Create database backup with metadata
4. Pre-migration backup
5. Run migrations with verification
6. Zero-downtime deployment (PM2 reload)
7. Health checks (10 retries)
8. Comprehensive smoke tests
9. Setup monitoring
10. Generate deployment report

**Automatic Rollback:**

- Triggers on any failure
- Restores database
- Rolls back migrations
- Restarts previous version

**Output:**

- Deployment log: `logs/deploy-production-*.log`
- Deployment report: `logs/deployment-report-*.md`
- Backup files: `backups/production/backup-*.gz`

### rollback-production.sh

**Rollback Steps:**

1. Confirmation prompt
2. Stop application
3. List available backups
4. Restore database from latest backup
5. Rollback migrations
6. Restart application
7. Health check verification

**Output:**

- Rollback log: `logs/rollback-production-*.log`

### monitor-production.sh

**Monitoring Checks:**

- Application health (every 60s)
- PM2 status
- Memory usage (alert at 80%)
- CPU usage (alert at 80%)
- Error logs (alert at 10+ errors)
- Database connectivity
- Disk space (alert at 80%)

**Alerting:**

- Configurable thresholds
- Alert function (customize for your notification system)
- Detailed logging

**Output:**

- Monitor log: `logs/monitor-*.log`

## Configuration

### Environment Variables

**Required:**

- `NODE_ENV` - Environment (staging/production)
- `PORT` - Application port
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - JWT secret key

**Optional:**

- `STAGING_URL` - Staging application URL
- `PRODUCTION_URL` - Production application URL
- `CORS_ORIGIN` - CORS allowed origins

### Script Configuration

Edit variables at the top of each script:

```bash
# deploy-production.sh
BACKUP_DIR="./backups/production"
SMOKE_TEST_TIMEOUT=60
HEALTH_CHECK_RETRIES=10
ROLLBACK_ENABLED=true

# monitor-production.sh
MONITOR_INTERVAL=60
ALERT_THRESHOLD_MEMORY=80
ALERT_THRESHOLD_CPU=80
ALERT_THRESHOLD_ERRORS=10
```

## Logs and Backups

### Log Files

- `logs/deploy-staging-*.log` - Staging deployment logs
- `logs/deploy-production-*.log` - Production deployment logs
- `logs/rollback-production-*.log` - Rollback logs
- `logs/monitor-*.log` - Monitoring logs

### Backup Files

- `backups/staging/backup-*.gz` - Staging backups
- `backups/production/backup-*.gz` - Production backups
- `backups/production/backup-*.json` - Backup metadata

### Retention Policy

- Keep last 10 deployment backups
- Automatic cleanup of old backups

## Troubleshooting

### Script Fails to Execute

```bash
# Make executable
chmod +x scripts/*.sh

# Check bash path
which bash

# Run with bash explicitly
bash scripts/deploy-staging.sh
```

### MongoDB Tools Not Found

```bash
# Install MongoDB tools
sudo apt-get install mongodb-database-tools

# Verify installation
which mongodump
which mongorestore
```

### PM2 Not Found

```bash
# Install PM2 globally
npm install -g pm2

# Verify installation
which pm2
pm2 --version
```

### Permission Denied

```bash
# Fix script permissions
chmod +x scripts/*.sh

# Fix directory permissions
chmod 755 scripts/
```

### Database Connection Failed

```bash
# Test connection
node -e "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGO_URI).then(() => console.log('OK')).catch(e => console.error(e));"

# Check MongoDB status
systemctl status mongod

# Check connection string
echo $MONGO_URI
```

## Best Practices

### Before Deployment

1. ✅ Test on staging first
2. ✅ Complete UAT testing
3. ✅ Review deployment checklist
4. ✅ Notify stakeholders
5. ✅ Schedule maintenance window (if needed)
6. ✅ Have rollback plan ready

### During Deployment

1. ✅ Monitor deployment logs
2. ✅ Watch for errors
3. ✅ Verify each step completes
4. ✅ Keep stakeholders informed

### After Deployment

1. ✅ Monitor for 24 hours
2. ✅ Check error rates
3. ✅ Verify functionality
4. ✅ Review metrics
5. ✅ Document any issues

## Security

### Sensitive Data

- Never commit `.env.production` to version control
- Use strong, unique secrets
- Rotate secrets regularly
- Secure backup storage

### Access Control

- Restrict deployment script access
- Use SSH keys for server access
- Implement two-person rule for production
- Audit all deployments

### Monitoring

- Secure monitoring endpoints
- Authenticate alert webhooks
- Encrypt logs
- Regular security audits

## Support

### Documentation

- [Deployment Guide](../DEPLOYMENT.md)
- [Quick Reference](../DEPLOYMENT_QUICK_REFERENCE.md)
- [Deployment Checklist](../../.kiro/specs/contract-payment-edit/DEPLOYMENT_CHECKLIST.md)

### Contacts

- **DevOps Team**: devops@yourdomain.com
- **On-Call Engineer**: oncall@yourdomain.com
- **Emergency**: +1-XXX-XXX-XXXX

## Contributing

When adding new deployment scripts:

1. Follow existing naming convention
2. Add comprehensive error handling
3. Include logging
4. Add rollback capability
5. Update this README
6. Test thoroughly on staging

## License

Internal use only - Company proprietary

---

**Last Updated**: 2025-01-XX
**Maintained By**: DevOps Team

## Database Scripts

### 🔍 verify-payment-indexes.ts

Verification script for Payment collection indexes:

- Lists all indexes on Payment collection
- Verifies required indexes exist
- Checks index configuration
- Displays collection statistics

**Usage:**

```bash
npx ts-node scripts/verify-payment-indexes.ts
# or
npm run verify:indexes
```

**Required Indexes:**

1. `idx_isPaid_status` - Compound index on isPaid and status fields
2. `idx_date` - Index on date field for sorting

**Output Example:**

```
📋 Checking indexes on Payment collection...

Current indexes:
================

1. _id_
   Keys: {"_id":1}

2. idx_isPaid_status
   Keys: {"isPaid":1,"status":1}
   Background: true

3. idx_date
   Keys: {"date":-1}
   Background: true

🔍 Verifying required indexes...

✅ idx_isPaid_status: Found and correct
✅ idx_date: Found and correct

📊 Collection Statistics:

Total documents: 1234
Total indexes: 3
Total index size: 45.67 KB

==================================================
🎉 All required indexes are properly configured!
==================================================
```

**When to Use:**

- After running migration 002
- When troubleshooting slow queries
- During performance optimization
- As part of deployment verification

**Related:**

- Migration: `src/migrations/002-add-payment-indexes.ts`
- Schema: `src/schemas/payment.schema.ts`
- Migration docs: `src/migrations/README.md`
