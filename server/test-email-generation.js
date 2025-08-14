const connectDB = require('./config/database');
const emailGenerationService = require('./services/emailGenerationService');

async function testEmailGeneration() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDB();
    
    console.log('✅ Database connected successfully');
    
    // Test creating a session
    console.log('\n📝 Testing session creation...');
    const testData = {
      firstName: 'John',
      lastName: 'Doe',
      domain: 'example.com',
      useCustomNames: true,
      selectedCustomNames: ['john.doe', 'jdoe'],
      domainsFromFile: ['test1.com', 'test2.com']
    };
    
    const session = await emailGenerationService.createSession(testData);
    console.log('✅ Session created:', session.sessionId);
    
    // Test updating webhook response
    console.log('\n🔗 Testing webhook response update...');
    const webhookData = {
      output: JSON.stringify({
        Founder: "John Smith",
        CEO: "Jane Johnson",
        CTO: "Bob Wilson",
        COO: null
      }),
      domain: "example.com",
      timestamp: new Date().toISOString(),
      note: "Test webhook data"
    };
    
    await emailGenerationService.updateWebhookResponse(session.sessionId, webhookData);
    console.log('✅ Webhook response updated');
    
    // Test saving generated emails
    console.log('\n📧 Testing email saving...');
    const testEmails = [
      { email: 'john.doe@example.com', confidence: 95 },
      { email: 'jdoe@example.com', confidence: 90 },
      { email: 'john@example.com', confidence: 85 },
      { email: 'j.doe@example.com', confidence: 80 }
    ];
    
    await emailGenerationService.saveGeneratedEmails(session.sessionId, testEmails, {
      processingTime: 1500
    });
    console.log('✅ Generated emails saved');
    
    // Test saving verification results
    console.log('\n✅ Testing verification results saving...');
    const verificationResults = [
      {
        email: 'john.doe@example.com',
        reachable: 'yes',
        syntax: { username: 'john.doe', domain: 'example.com', valid: true },
        smtp: { host_exists: true, deliverable: true, disabled: false },
        verificationMethod: 'neverbounce',
        cost: 0.01
      },
      {
        email: 'jdoe@example.com',
        reachable: 'no',
        syntax: { username: 'jdoe', domain: 'example.com', valid: true },
        smtp: { host_exists: true, deliverable: false, disabled: false },
        verificationMethod: 'neverbounce',
        cost: 0.01
      }
    ];
    
    await emailGenerationService.saveVerificationResults(session.sessionId, verificationResults);
    console.log('✅ Verification results saved');
    
    // Test retrieving the session
    console.log('\n📖 Testing session retrieval...');
    const retrievedSession = await emailGenerationService.getSession(session.sessionId);
    console.log('✅ Session retrieved successfully');
    console.log('📊 Session statistics:', {
      totalEmails: retrievedSession.generatedEmails.length,
      emailsVerified: retrievedSession.statistics.emailsVerified,
      deliverableEmails: retrievedSession.statistics.deliverableEmails,
      totalCost: retrievedSession.statistics.totalVerificationCost
    });
    
    console.log('\n🎉 All tests passed successfully!');
    console.log('📋 Session ID:', session.sessionId);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Close database connection
    const mongoose = require('mongoose');
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the test
testEmailGeneration();
