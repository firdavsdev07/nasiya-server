# 🚀 DEPLOYMENT - To'lov Tizimi Yangilanishlari

## Pre-Deployment Checklist

- [ ] Backup olindi
- [ ] Test muhitda sinaldi
- [ ] Migration tayyor
- [ ] Team xabardor

## Deployment Steps

### 1. Backup oling

```bash
# MongoDB backup
mongodump --uri="mongodb://YOUR_MONGO_URI/nasiya" --out=backup_$(date +%Y%m%d_%H%M%S)

# Code backup (git)
git tag -a v1.0.0-payment-fix -m "Payment system fixes"
git push origin v1.0.0-payment-fix
```

### 2. Server'ga o'ting

```bash
ssh your-server
cd /path/to/nasiya-server
```

### 3. Pull changes

```bash
git pull origin main
npm install
```

### 4. Migration ishga tushiring

```bash
# Test migration (dry-run)
NODE_ENV=production npx ts-node src/migrations/004-add-target-month-to-payments.ts

# Check results
echo "Migration completed. Check logs above."
```

### 5. Restart services

```bash
# Backend
pm2 restart nasiya-server

# Bot (agar alohida)
pm2 restart nasiya-bot

# Web rebuild (agar kerak bo'lsa)
cd nasiya-web
npm run build
```

### 6. Monitor qiling

```bash
# Logs
pm2 logs nasiya-server --lines 200

# Real-time monitoring
pm2 monit

# Specific grep
pm2 logs nasiya-server | grep "ERROR\|WARN\|Payment\|Contract"
```

### 7. Health check

```bash
# API health
curl http://localhost:3000/health

# Database connection
mongosh --eval "db.adminCommand('ping')"

# Test payment
# Bot orqali bitta test to'lov qiling
```

## Rollback Plan

Agar muammo bo'lsa:

```bash
# 1. Stop services
pm2 stop nasiya-server

# 2. Restore database
mongorestore --uri="mongodb://YOUR_MONGO_URI/nasiya" --drop backup_YYYYMMDD_HHMMSS/

# 3. Revert code
git revert HEAD
npm install

# 4. Restart
pm2 restart nasiya-server
```

## Post-Deployment

### 24 soat ichida:

- [ ] Logs monitored
- [ ] No critical errors
- [ ] Users can make payments
- [ ] Cash approval works
- [ ] Excess payments distributed correctly

### 1 hafta ichida:

- [ ] Performance metrics reviewed
- [ ] User feedback collected
- [ ] Database queries optimized if needed

## Contacts

**Emergency:** [Your Phone]
**Team Lead:** [Lead Phone]
**DevOps:** [DevOps Phone]

---

**Deployed by:** [Your Name]
**Date:** [Date]
**Version:** v1.0.0-payment-fix
**Status:** ✅ Success / ❌ Rolled Back
