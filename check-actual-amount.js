const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Payment schema'ni to'g'ridan-to'g'ri yaratamiz
const PaymentSchema = new mongoose.Schema({
  amount: Number,
  actualAmount: Number,
  date: Date,
  isPaid: Boolean,
  paymentType: String,
  status: String,
  remainingAmount: Number,
  excessAmount: Number,
  expectedAmount: Number,
}, { timestamps: true });

const Payment = mongoose.model('Payment', PaymentSchema);

async function checkActualAmount() {
  try {
    await mongoose.connect(process.env.MONGO_DB);
    console.log('✅ Connected to MongoDB');

    // To'langan to'lovlarni tekshirish
    const paidPayments = await Payment.find({ isPaid: true }).limit(10);

    console.log('\n📊 Checking paid payments:');
    console.log('Total paid payments:', await Payment.countDocuments({ isPaid: true }));
    
    let withActualAmount = 0;
    let withoutActualAmount = 0;

    for (const payment of paidPayments) {
      if (payment.actualAmount !== undefined && payment.actualAmount !== null) {
        withActualAmount++;
        console.log(`✅ Payment ${payment._id}: actualAmount = ${payment.actualAmount}, amount = ${payment.amount}`);
      } else {
        withoutActualAmount++;
        console.log(`❌ Payment ${payment._id}: NO actualAmount, amount = ${payment.amount}`);
      }
    }

    console.log('\n📈 Summary:');
    console.log(`With actualAmount: ${withActualAmount}`);
    console.log(`Without actualAmount: ${withoutActualAmount}`);

    // Barcha to'lovlar uchun statistika
    const allPaidPayments = await Payment.find({ isPaid: true });
    let totalWithActualAmount = 0;
    let totalWithoutActualAmount = 0;

    for (const payment of allPaidPayments) {
      if (payment.actualAmount !== undefined && payment.actualAmount !== null) {
        totalWithActualAmount++;
      } else {
        totalWithoutActualAmount++;
      }
    }

    console.log('\n📊 All paid payments:');
    console.log(`Total with actualAmount: ${totalWithActualAmount}`);
    console.log(`Total without actualAmount: ${totalWithoutActualAmount}`);

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkActualAmount();
