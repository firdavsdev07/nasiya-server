// Test script for customer API
const axios = require('axios');

const API_URL = 'http://localhost:3000/api/bot';
const CUSTOMER_ID = '6919e33ef3c9234144441fb5';

// You need to replace this with a valid token
const TOKEN = 'YOUR_TOKEN_HERE';

async function testCustomerAPI() {
  try {
    console.log('🔍 Testing Customer API...');
    console.log('📋 Customer ID:', CUSTOMER_ID);
    console.log('🔗 API URL:', `${API_URL}/customer/get-by-id/${CUSTOMER_ID}`);
    
    const response = await axios.get(
      `${API_URL}/customer/get-by-id/${CUSTOMER_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`
        }
      }
    );
    
    console.log('\n✅ Success!');
    console.log('📊 Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('\n❌ Error!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run test
testCustomerAPI();
