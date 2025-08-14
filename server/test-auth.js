const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001/api';

// Test data
const testUser = {
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  password: 'TestPass123!',
  confirmPassword: 'TestPass123!',
  phone: '+1234567890',
  agreeToTerms: true
};

const loginData = {
  email: 'test@example.com',
  password: 'TestPass123!'
};

async function testAuth() {
  console.log('🧪 Testing Authentication System...\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Check...');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health Check:', healthData.message);
    console.log('');

    // Test 2: User Registration
    console.log('2️⃣ Testing User Registration...');
    const registerResponse = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testUser)
    });

    if (registerResponse.ok) {
      const registerData = await registerResponse.json();
      console.log('✅ Registration successful:', registerData.message);
      console.log('   User ID:', registerData.data.user._id);
      console.log('   Token received:', !!registerData.data.token);
    } else {
      const errorData = await registerResponse.json();
      if (errorData.message.includes('already exists')) {
        console.log('⚠️ User already exists, continuing with login test...');
      } else {
        console.log('❌ Registration failed:', errorData.message);
        return;
      }
    }
    console.log('');

    // Test 3: User Login
    console.log('3️⃣ Testing User Login...');
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(loginData)
    });

    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      console.log('✅ Login successful:', loginData.message);
      console.log('   User:', loginData.data.user.fullName);
      console.log('   Token received:', !!loginData.data.token);
      
      const token = loginData.data.token;
      console.log('');

      // Test 4: Get User Profile (Protected Route)
      console.log('4️⃣ Testing Protected Route - Get Profile...');
      const profileResponse = await fetch(`${BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        console.log('✅ Profile retrieved successfully');
        console.log('   User:', profileData.data.user.fullName);
        console.log('   Email:', profileData.data.user.email);
        console.log('   Role:', profileData.data.user.role);
      } else {
        const errorData = await profileResponse.json();
        console.log('❌ Profile retrieval failed:', errorData.message);
      }
      console.log('');

      // Test 5: Update Profile
      console.log('5️⃣ Testing Profile Update...');
      const updateData = {
        firstName: 'Updated',
        lastName: 'User',
        preferences: {
          theme: 'dark',
          notifications: {
            email: true,
            push: false
          }
        }
      };

      const updateResponse = await fetch(`${BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (updateResponse.ok) {
        const updateResponseData = await updateResponse.json();
        console.log('✅ Profile updated successfully:', updateResponseData.message);
        console.log('   New name:', updateResponseData.data.user.fullName);
        console.log('   Theme preference:', updateResponseData.data.user.preferences.theme);
      } else {
        const errorData = await updateResponse.json();
        console.log('❌ Profile update failed:', errorData.message);
      }
      console.log('');

      // Test 6: Logout
      console.log('6️⃣ Testing Logout...');
      const logoutResponse = await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (logoutResponse.ok) {
        const logoutData = await logoutResponse.json();
        console.log('✅ Logout successful:', logoutData.message);
      } else {
        const errorData = await logoutResponse.json();
        console.log('❌ Logout failed:', errorData.message);
      }

    } else {
      const errorData = await loginResponse.json();
      console.log('❌ Login failed:', errorData.message);
      return;
    }

    console.log('\n🎉 All authentication tests completed!');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.log('\n💡 Make sure the server is running on port 3001');
    console.log('💡 Check that MongoDB is connected');
    console.log('💡 Verify the config.env file is set up correctly');
  }
}

// Test validation errors
async function testValidation() {
  console.log('\n🔍 Testing Input Validation...\n');

  try {
    // Test invalid email
    console.log('1️⃣ Testing Invalid Email...');
    const invalidEmailData = { ...testUser, email: 'invalid-email' };
    const response = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidEmailData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log('✅ Validation caught invalid email:', errorData.errors[0].message);
    }
    console.log('');

    // Test weak password
    console.log('2️⃣ Testing Weak Password...');
    const weakPasswordData = { ...testUser, password: 'weak', confirmPassword: 'weak' };
    const weakPassResponse = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(weakPasswordData)
    });

    if (!weakPassResponse.ok) {
      const errorData = await weakPassResponse.json();
      console.log('✅ Validation caught weak password:', errorData.errors[0].message);
    }
    console.log('');

    // Test password mismatch
    console.log('3️⃣ Testing Password Mismatch...');
    const mismatchData = { ...testUser, confirmPassword: 'DifferentPass123!' };
    const mismatchResponse = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mismatchData)
    });

    if (!mismatchResponse.ok) {
      const errorData = await mismatchResponse.json();
      console.log('✅ Validation caught password mismatch:', errorData.errors[0].message);
    }

    console.log('\n✅ All validation tests completed!');

  } catch (error) {
    console.error('❌ Validation test failed:', error.message);
  }
}

// Run tests
async function runTests() {
  await testAuth();
  await testValidation();
}

// Check if server is running before testing
async function checkServer() {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    if (response.ok) {
      console.log('🚀 Server is running, starting tests...\n');
      await runTests();
    } else {
      console.log('❌ Server health check failed');
    }
  } catch (error) {
    console.log('❌ Cannot connect to server. Make sure it\'s running on port 3001');
    console.log('💡 Run: npm run dev');
  }
}

checkServer();
