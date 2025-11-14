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

async function fixActualAmount() {
  try {
    await mongoose.connect(process.env.MONGO_DB);
    console.log('✅ Connected to MongoDB');

    // actualAmount yo'q to'lovlarni topish
    const paymentsWithoutActualAmount = await Payment.find({
      isPaid: true,
      $or: [
        { actualAmount: { $exists: false } },
        { actualAmount: null }
      ]
    });

    console.log(`\n📊 Found ${paymentsWithoutActualAmount.length} payments without actualAmount`);

    let fixed = 0;
    for (const payment of paymentsWithoutActualAmount) {
      console.log(`\n🔧 Fixing payment ${payment._id}:`);
      console.log(`   amount: ${payment.amount}`);
      
      // actualAmount = amount deb belgilaymiz (eski to'lovlar uchun)
      payment.actualAmount = payment.amount;
      await payment.save();
      
      console.log(`   ✅ actualAmount set to: ${payment.actualAmount}`);
      fixed++;
    }

    console.log(`\n✅ Fixed ${fixed} payments`);

    // Tekshirish
    const remainingWithoutActualAmount = await Payment.countDocuments({
      isPaid: true,
      $or: [
        { actualAmount: { $exists: false } },
        { actualAmount: null }
      ]
    });

    console.log(`\n📊 Remaining payments without actualAmount: ${remainingWithoutActualAmount}`);

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixActualAmount();
