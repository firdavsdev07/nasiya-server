// Script to check if any contracts have null/undefined nextPaymentDate
require('dotenv').config();
const mongoose = require('mongoose');

async function checkNextPaymentDate() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_DB);
    console.log('✅ Connected to MongoDB\n');

    const Contract = mongoose.model('Contract', new mongoose.Schema({}, { strict: false }));

    // Total contracts
    const totalContracts = await Contract.countDocuments({ status: 'active' });
    console.log(`📊 Total active contracts: ${totalContracts}`);

    // Contracts with nextPaymentDate
    const withNextPaymentDate = await Contract.countDocuments({
      status: 'active',
      nextPaymentDate: { $exists: true, $ne: null }
    });
    console.log(`✅ Contracts with nextPaymentDate: ${withNextPaymentDate}`);

    // Contracts WITHOUT nextPaymentDate
    const withoutNextPaymentDate = await Contract.countDocuments({
      status: 'active',
      $or: [
        { nextPaymentDate: { $exists: false } },
        { nextPaymentDate: null }
      ]
    });
    console.log(`❌ Contracts WITHOUT nextPaymentDate: ${withoutNextPaymentDate}`);

    if (withoutNextPaymentDate > 0) {
      console.log('\n⚠️ Contracts without nextPaymentDate:');
      const contracts = await Contract.find({
        status: 'active',
        $or: [
          { nextPaymentDate: { $exists: false } },
          { nextPaymentDate: null }
        ]
      }).select('_id productName customer startDate nextPaymentDate').limit(10);

      contracts.forEach(c => {
        console.log(`  - ${c.productName} (${c._id})`);
        console.log(`    startDate: ${c.startDate}`);
        console.log(`    nextPaymentDate: ${c.nextPaymentDate}`);
      });
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkNextPaymentDate();
