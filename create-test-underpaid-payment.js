const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Schemas
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
  customerId: mongoose.Schema.Types.ObjectId,
  managerId: mongoose.Schema.Types.ObjectId,
  notes: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });

const ContractSchema = new mongoose.Schema({
  customer: mongoose.Schema.Types.ObjectId,
  monthlyPayment: Number,
  payments: [mongoose.Schema.Types.ObjectId],
  totalPaid: Number,
  totalPrice: Number,
  remainingDebt: Number,
}, { timestamps: true });

const NotesSchema = new mongoose.Schema({
  text: String,
  customer: mongoose.Schema.Types.ObjectId,
  createBy: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });

const Payment = mongoose.model('Payment', PaymentSchema);
const Contract = mongoose.model('Contract', ContractSchema);
const Notes = mongoose.model('Notes', NotesSchema);

async function createTestUnderpaidPayment() {
  try {
    await mongoose.connect(process.env.MONGO_DB);
    console.log('✅ Connected to MongoDB');

    // Birinchi active contractni topish
    const contract = await Contract.findOne({ 
      isActive: true
    }).populate('customer');

    if (!contract) {
      console.log('❌ No active contract found');
      await mongoose.disconnect();
      return;
    }

    console.log('\n📋 Contract found:');
    console.log(`   ID: ${contract._id}`);
    console.log(`   Monthly payment: ${contract.monthlyPayment}`);
    console.log(`   Customer: ${contract.customer}`);

    // Kam to'langan to'lov yaratish
    const expectedAmount = contract.monthlyPayment;
    const actualAmount = expectedAmount * 0.7; // 70% to'lash (30% kam)
    const remainingAmount = expectedAmount - actualAmount;

    console.log('\n💰 Creating underpaid payment:');
    console.log(`   Expected: ${expectedAmount}`);
    console.log(`   Actual: ${actualAmount}`);
    console.log(`   Remaining: ${remainingAmount}`);

    // Notes yaratish
    const notes = await Notes.create({
      text: `TEST: Kam to'langan to'lov\nKutilgan: ${expectedAmount}$\nTo'langan: ${actualAmount}$\nQoldi: ${remainingAmount}$`,
      customer: contract.customer,
      createBy: contract.customer, // Test uchun
    });

    console.log(`✅ Notes created: ${notes._id}`);

    // Payment yaratish
    const payment = await Payment.create({
      amount: expectedAmount,
      actualAmount: actualAmount,
      date: new Date(),
      isPaid: true, // Test uchun darhol tasdiqlangan
      paymentType: 'monthly',
      status: 'UNDERPAID',
      remainingAmount: remainingAmount,
      excessAmount: 0,
      expectedAmount: expectedAmount,
      customerId: contract.customer,
      managerId: contract.customer, // Test uchun
      notes: notes._id,
    });

    console.log(`✅ Payment created: ${payment._id}`);

    // Contract'ga qo'shish
    if (!contract.payments) {
      contract.payments = [];
    }
    contract.payments.push(payment._id);
    await contract.save();

    console.log(`✅ Payment added to contract`);

    console.log('\n🎉 Test underpaid payment created successfully!');
    console.log('\n📊 Payment details:');
    console.log(`   ID: ${payment._id}`);
    console.log(`   Status: ${payment.status}`);
    console.log(`   Amount: ${payment.amount}`);
    console.log(`   Actual Amount: ${payment.actualAmount}`);
    console.log(`   Remaining Amount: ${payment.remainingAmount}`);

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createTestUnderpaidPayment();
