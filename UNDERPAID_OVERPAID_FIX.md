# ✅ Kam/Ko'p To'langan To'lovlar Kassada Ko'rinishi - Tuzatildi

## 🐛 Muammo

Kassaga faqat **to'g'ri to'langan** to'lovlar kelyapti edi. **Kam yoki ko'p to'langan** to'lovlar kassada ko'rinmayotgan edi.

### Sabab

1. **Bot to'lovlari** yaratilganda har doim `status: PENDING` qo'yilardi
2. Kam/ko'p to'langan holatda ham `PENDING` bo'lib qolardi
3. Kassa faqat `status: PENDING` to'lovlarni ko'rsatardi
4. `confirmPayment` metodida `status` ni `PAID` ga o'zgartirib yuborardi (kam/ko'p to'langan holatni yo'qotardi)

## ✅ Yechim

### 1. Bot To'lovlarida Status Aniqlash

**File**: `damen-server/src/bot/services/payment.service.ts`

```typescript
// ✅ TO'LOV TAHLILI - Kam yoki ko'p to'langanini aniqlash
const expectedAmount = contract?.monthlyPayment || 0;
const actualAmount = payData.amount;
const difference = actualAmount - expectedAmount;

let paymentStatus = PaymentStatus.PAID;
let remainingAmount = 0;
let excessAmount = 0;

// Kam to'langan (UNDERPAID)
if (difference < -0.01) {
  paymentStatus = PaymentStatus.UNDERPAID;
  remainingAmount = Math.abs(difference);
}
// Ko'p to'langan (OVERPAID)
else if (difference > 0.01) {
  paymentStatus = PaymentStatus.OVERPAID;
  excessAmount = difference;
}

const paymentDoc = await Payment.create({
  amount: expectedAmount, // ✅ OYLIK TO'LOV
  actualAmount: actualAmount, // ✅ HAQIQATDA TO'LANGAN SUMMA
  status: paymentStatus, // ✅ UNDERPAID / OVERPAID / PAID
  expectedAmount: expectedAmount,
  remainingAmount: remainingAmount,
  excessAmount: excessAmount,
});
```

### 2. Dashboard To'lovlarida Status Aniqlash

**File**: `damen-server/src/dashboard/services/payment.service.ts`

```typescript
// receivePayment metodida
const payment = await Payment.create({
  amount: expectedAmount, // ✅ OYLIK TO'LOV
  actualAmount: actualAmount, // ✅ HAQIQATDA TO'LANGAN SUMMA
  isPaid: false, // ❌ BOT TO'LOVI - Kassa tasdiqlashi kerak
  status: paymentStatus, // ✅ UNDERPAID / OVERPAID / PAID (to'lov holati)
  expectedAmount: expectedAmount,
  remainingAmount: remainingAmount,
  excessAmount: excessAmount,
  prepaidAmount: prepaidAmount,
});
```

### 3. Kassa - Barcha Tasdiqlanmagan To'lovlarni Ko'rsatish

**File**: `damen-server/src/dashboard/services/cash.service.ts`

```typescript
// ✅ Barcha tasdiqlanmagan to'lovlarni olish (isPaid: false)
const payments = await Payment.find({
  isPaid: false, // ✅ Faqat tasdiqlanmagan to'lovlar
})
```

**Oldingi kod** (noto'g'ri):
```typescript
const payments = await Payment.find({
  status: { $in: [PaymentStatus.PENDING, PaymentStatus.PAID] },
})
```

### 4. To'lovni Tasdiqlashda Status Saqlanishi

**File**: `damen-server/src/dashboard/services/payment.service.ts`

```typescript
// confirmPayment metodida
const originalStatus = payment.status; // Asl statusni saqlash
payment.isPaid = true;
// payment.status ni o'zgartirmaslik - u UNDERPAID/OVERPAID bo'lishi mumkin
payment.confirmedAt = new Date();
payment.confirmedBy = user.sub as any;
await payment.save();
```

**Oldingi kod** (noto'g'ri):
```typescript
payment.isPaid = true;
payment.status = PaymentStatus.PAID; // ❌ Status yo'qoladi
```

### 5. Balance Yangilashda actualAmount Ishlatish

```typescript
// ✅ actualAmount ishlatish (haqiqatda to'langan summa)
const amountToAdd = payment.actualAmount || payment.amount;
await this.updateBalance(payment.managerId, {
  dollar: amountToAdd,
  sum: 0,
});
```

### 6. Debtor O'chirish Mantiqini Tuzatish

```typescript
// 5. Debtor o'chirish (faqat to'liq to'langan bo'lsa)
// ✅ UNDERPAID bo'lsa debtor o'chirilmaydi
if (originalStatus !== PaymentStatus.UNDERPAID) {
  const deletedDebtors = await Debtor.deleteMany({
    contractId: contract._id,
  });
  
  if (deletedDebtors.deletedCount > 0) {
    console.log("🗑️ Debtor(s) deleted:", deletedDebtors.deletedCount);
  }
} else {
  console.log("⚠️ Debtor NOT deleted - payment is UNDERPAID");
}
```

## 📊 Natija

Endi **barcha to'lovlar** kassada ko'rinadi:

1. ✅ **To'g'ri to'langan** (PAID) - Kassada ko'rinadi
2. ✅ **Kam to'langan** (UNDERPAID) - Kassada ko'rinadi, debtor o'chirilmaydi
3. ✅ **Ko'p to'langan** (OVERPAID) - Kassada ko'rinadi, ortiqcha summa keyingi oyga o'tkaziladi

## 🎯 Test Scenariyalari

### 1. Kam To'langan
```
Input:
- Oylik: 325$
- To'langan: 300$

Expected:
- Payment: status=UNDERPAID, remainingAmount=25, isPaid=false
- Kassada ko'rinadi: "⚠️ Kam to'langan"
- Kassa tasdiqlangandan keyin: isPaid=true, status=UNDERPAID (saqlanadi)
- Debtor o'chirilmaydi
```

### 2. Ko'p To'langan
```
Input:
- Oylik: 325$
- To'langan: 350$

Expected:
- Payment: status=OVERPAID, excessAmount=25, isPaid=false
- Kassada ko'rinadi: "💰 Ko'p to'langan"
- Kassa tasdiqlangandan keyin: isPaid=true, status=OVERPAID (saqlanadi)
- Debtor o'chiriladi
- Ortiqcha summa keyingi oyga o'tkaziladi
```

### 3. To'g'ri To'langan
```
Input:
- Oylik: 325$
- To'langan: 325$

Expected:
- Payment: status=PAID, isPaid=false
- Kassada ko'rinadi: "✅ To'langan"
- Kassa tasdiqlangandan keyin: isPaid=true, status=PAID
- Debtor o'chiriladi
```

## 📝 Xulosa

Muammo to'liq hal qilindi! Endi kassaga **barcha tasdiqlanmagan to'lovlar** keladi:
- ✅ Kam to'langan to'lovlar ko'rinadi
- ✅ Ko'p to'langan to'lovlar ko'rinadi
- ✅ To'g'ri to'langan to'lovlar ko'rinadi
- ✅ Barcha ma'lumotlar (`remainingAmount`, `excessAmount`) saqlanadi
- ✅ Kassa xodimi barcha to'lovlarni ko'radi va tasdiqlaydi

---

**Sana**: 2025-01-12  
**Versiya**: 5.0.0  
**Status**: ✅ Hal qilindi
