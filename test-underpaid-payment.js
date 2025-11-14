const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Payment schema
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

async function testUnderpaidPayment() {
  try {
    await mongoose.connect(process.env.MONGO_DB);
    console.log('✅ Connected to MongoDB');

    // Barcha to'lovlarni tekshirish
    const allPayments = await Payment.find({ isPaid: true });
    
    console.log('\n📊 Checking all paid payments:');
    console.log(`Total paid payments: ${allPayments.length}\n`);

    let underpaidCount = 0;
    let overpaidCount = 0;
    let exactCount = 0;

    for (const payment of allPayments) {
      const hasRemainingAmount = payment.remainingAmount && payment.remainingAmount > 0.01;
      const hasExcessAmount = payment.excessAmount && payment.excessAmount > 0.01;
      
      if (hasRemainingAmount) {
        underpaidCount++;
        console.log(`⚠️ UNDERPAID Payment ${payment._id}:`);
        console.log(`   Expected: ${payment.amount || payment.expectedAmount}`);
        console.log(`   Actual: ${payment.actualAmount}`);
        console.log(`   Remaining: ${payment.remainingAmount}`);
        console.log(`   Status: ${payment.status}`);
        console.log('');
      } else if (hasExcessAmount) {
        overpaidCount++;
        console.log(`✅ OVERPAID Payment ${payment._id}:`);
        console.log(`   Expected: ${payment.amount || payment.expectedAmount}`);
        console.log(`   Actual: ${payment.actualAmount}`);
        console.log(`   Excess: ${payment.excessAmount}`);
        console.log(`   Status: ${payment.status}`);
        console.log('');
      } else {
        exactCount++;
      }
    }

    console.log('\n📈 Summary:');
    console.log(`Underpaid payments: ${underpaidCount}`);
    console.log(`Overpaid payments: ${overpaidCount}`);
    console.log(`Exact payments: ${exactCount}`);

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testUnderpaidPayment();
