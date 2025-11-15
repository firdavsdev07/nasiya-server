// Database'da foydalanuvchi rolini tekshirish
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_DB = process.env.MONGO_DB || 'mongodb://localhost:27017/nasiya_db';

async function checkUserRole() {
  try {
    await mongoose.connect(MONGO_DB);
    console.log('✅ MongoDB'ga ulandi');

    const Employee = mongoose.model('Employee', new mongoose.Schema({}, { strict: false }));
    const Role = mongoose.model('Role', new mongoose.Schema({}, { strict: false }));

    // Barcha xodimlarni olish
    const employees = await Employee.find({}).populate('role').lean();

    console.log('\n📋 Barcha xodimlar:');
    console.log('='.repeat(80));

    for (const emp of employees) {
      console.log(`\n👤 ${emp.firstName} ${emp.lastName}`);
      console.log(`   📞 Telefon: ${emp.phoneNumber}`);
      console.log(`   🎭 Rol: ${emp.role?.name || 'Rol yo\'q!'}`);
      console.log(`   ✅ Faol: ${emp.isActive}`);
      console.log(`   🆔 ID: ${emp._id}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 Jami: ${employees.length} ta xodim`);

    await mongoose.disconnect();
    console.log('\n✅ MongoDB'dan uzildi');
  } catch (error) {
    console.error('❌ Xato:', error);
    process.exit(1);
  }
}

checkUserRole();
