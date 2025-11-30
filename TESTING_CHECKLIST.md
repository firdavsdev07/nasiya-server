# 🧪 TO'LOV TIZIMI - TEST CHECKLIST

## Test Muhiti Tayyorlash

```bash
# 1. Backup oling
mongodump --uri="mongodb://localhost:27017/nasiya" --out=backup_$(date +%Y%m%d)

# 2. Migration ishga tushiring
cd nasiya-server
npx ts-node src/migrations/004-add-target-month-to-payments.ts

# 3. Server restart
pm2 restart nasiya-server
pm2 logs nasiya-server --lines 100
```

## ✅ Test Senariylari

### 1️⃣ BOT - To'lov qilish (PENDING)

**Test:**
1. Botda mijoz tanlang
2. To'lov qiling (masalan 100$)
3. Tekshiring:
   - ✅ Payment PENDING statusda yaratildi
   - ✅ Contract.payments da YO'Q (faqat kassa tasdiqlangandan keyin)
   - ✅ nextPaymentDate YANGILANMADI
   - ✅ Balance YANGILANMADI

**Kutilgan log:**
```
⏳ Payment created in PENDING status
⏳ Waiting for cash confirmation
⏳ nextPaymentDate will be updated after confirmation
```

---

### 2️⃣ KASSA - To'lovni tasdiqlash

**Test:**
1. Web dashboardda Cash sahifasiga o'ting
2. PENDING to'lovni tanlang
3. "Tasdiqlash" tugmasini bosing
4. Tekshiring:
   - ✅ Payment PAID statusga o'tdi
   - ✅ Contract.payments ga QO'SHILDI
   - ✅ nextPaymentDate YANGILANDI (keyingi oyga)
   - ✅ Balance YANGILANDI

**Kutilgan log:**
```
✅ Payment confirmed: [paymentId]
✅ Payment added to contract.payments
✅ Balance updated
📅 nextPaymentDate updated to next month
```

---

### 3️⃣ KASSA - To'lovni rad etish

**Test:**
1. Botda yangi to'lov qiling
2. Kassada rad eting (sabab kiriting)
3. Tekshiring:
   - ✅ Payment REJECTED statusga o'tdi
   - ✅ Contract.payments dan O'CHIRILDI (qo'shilgan bo'lsa)
   - ✅ prepaidBalance KAMAYTIRDI (ortiqcha bo'lgan bo'lsa)
   - ✅ Notes'ga sabab qo'shildi

**Kutilgan log:**
```
✅ Payment rejected: [paymentId]
✅ Payment removed from contract.payments
✅ Prepaid balance reduced: X $
```

---

### 4️⃣ ORTIQCHA TO'LOV - Avtomatik keyingi oylar

**Test:**
1. Oylik to'lov 100$ bo'lgan shartnoma toping
2. 250$ to'lov qiling (2.5 oy uchun)
3. Kassada tasdiqla ng
4. Tekshiring:
   - ✅ 2 ta yangi payment avtomatik yaratildi (keyingi 2 oy uchun)
   - ✅ 50$ prepaidBalance ga qo'shildi
   - ✅ Har bir payment PAID statusda
   - ✅ targetMonth to'g'ri (3, 4)

**Kutilgan log:**
```
💰 Processing excess amount: 150.00 $
✅ Additional payment created for month 3
✅ Additional payment created for month 4
💰 Prepaid balance updated: 50.00 $
✅ Created 2 additional payment(s) from excess
```

---

### 5️⃣ KAM TO'LOV - UNDERPAID

**Test:**
1. Oylik to'lov 100$ bo'lgan shartnoma toping
2. 70$ to'lov qiling (kam to'lov)
3. Kassada tasdiqlang
4. Tekshiring:
   - ✅ Payment UNDERPAID statusda
   - ✅ remainingAmount = 30$
   - ✅ Debtor yaratilmadi (chunki to'lov qabul qilindi)

**Kutilgan log:**
```
✅ Payment status: UNDERPAID
⚠️ Remaining amount: 30.00 $
```

---

### 6️⃣ QOLGAN QARZNI TO'LASH

**Test:**
1. UNDERPAID to'lov toping (masalan 30$ qarz)
2. "Qolgan qarzni to'lash" qiling (30$)
3. Tekshiring:
   - ✅ Payment PAID statusga o'tdi
   - ✅ remainingAmount = 0
   - ✅ Debtor o'chirildi

**Kutilgan log:**
```
✅ Payment status changed to PAID
✅ Balance updated
🗑️ Debtor(s) deleted: 1
```

---

### 7️⃣ TO'LOVNI KEYINGA QOLDIRISH

**Test:**
1. Shartnomani toping (masalan nextPaymentDate = 15-yan)
2. Botda "Keyinga qoldirish" (masalan 25-yan)
3. Tekshiring:
   - ✅ nextPaymentDate = 25-yan
   - ✅ previousPaymentDate = 15-yan saqlanadi
   - ✅ originalPaymentDay = 15 saqlanadi
   - ✅ postponedAt vaqti saqlanadi
4. Keyin to'lov qiling va tasdiqlang
5. Tekshiring:
   - ✅ nextPaymentDate asl kuniga qaytadi (15-fev)

**Kutilgan log:**
```
✅ Yangi keyingi to'lov sanasi: 25-yan
🔄 Kechiktirilgan to'lov to'landi - asl sanaga qaytarildi
```

---

### 8️⃣ BARCHA OYLARNI TO'LASH

**Test:**
1. 6 oylik shartnoma, 2 oy to'langan
2. "Barchasini to'lash" (4 oy uchun, 400$)
3. Tekshiring:
   - ✅ 4 ta payment yaratildi
   - ✅ Barcha PAID statusda
   - ✅ targetMonth to'g'ri (3,4,5,6)
   - ✅ Contract status = COMPLETED

**Kutilgan log:**
```
💰 === PAY ALL REMAINING MONTHS (DASHBOARD) ===
✅ Payment created for month 3
✅ Payment created for month 4
✅ Payment created for month 5
✅ Payment created for month 6
✅ Contract status changed to COMPLETED
```

---

## 🔍 Database Tekshirish

```bash
# MongoDB shell
mongosh

use nasiya

# 1. PENDING to'lovlar
db.payments.find({ status: "PENDING" }).count()

# 2. targetMonth mavjudligi
db.payments.find({ targetMonth: { $exists: false } }).count()
# Natija: 0 bo'lishi kerak

# 3. Contract.payments
db.contracts.findOne({ _id: ObjectId("...") }).payments

# 4. prepaidBalance
db.contracts.find({ prepaidBalance: { $gt: 0 } })
```

---

## 🚨 Xatoliklar

Agar quyidagi xatoliklar paydo bo'lsa:

### "targetMonth is required"
```bash
# Migration ishlamagan
npx ts-node src/migrations/004-add-target-month-to-payments.ts
```

### "Contract not found"
```bash
# Logs tekshiring
pm2 logs nasiya-server | grep "Contract not found"
```

### "Payment already in contract.payments"
```bash
# Normal - bu duplikatdan saqlanish
# Ignore qiling
```

---

## ✅ Yakuniy Tekshiruv

- [ ] Bot to'lovi PENDING statusda
- [ ] Kassa tasdig'i ishlayapti
- [ ] Kassa rad etish ishlayapti
- [ ] Ortiqcha to'lov avtomatik taqsimlanadi
- [ ] Kam to'lov UNDERPAID statusda
- [ ] Qolgan qarz to'lanadi
- [ ] To'lov keyinga qoldiriladi
- [ ] Barcha oylar to'lanadi
- [ ] targetMonth barcha to'lovlarda bor
- [ ] Loglar to'g'ri

---

**Test yakunlangandan keyin:**
1. Backup oling
2. Production ga deploy qiling
3. Monitor qiling (24 soat)

