const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./models/User');
const EmailDiscovery = require('./models/EmailDiscovery');
const DiscoverySession = require('./models/DiscoverySession');

// Test configuration
const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_PASSWORD = 'TestPassword123!';

class EmailDiscoveryTester {
  constructor() {
    this.testUserId = null;
    this.testSessionId = null;
    this.testEmailIds = [];
  }

  async connect() {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      process.exit(1);
    }
  }

  async cleanup() {
    try {
      // Clean up test data
      if (this.testUserId) {
        await User.findByIdAndDelete(this.testUserId);
        console.log('🧹 Cleaned up test user');
      }
      
      if (this.testSessionId) {
        await DiscoverySession.findByIdAndDelete(this.testSessionId);
        console.log('🧹 Cleaned up test session');
      }
      
      if (this.testEmailIds.length > 0) {
        await EmailDiscovery.deleteMany({ _id: { $in: this.testEmailIds } });
        console.log('🧹 Cleaned up test emails');
      }
      
      await mongoose.connection.close();
      console.log('✅ Disconnected from MongoDB');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  async createTestUser() {
    try {
      // Check if test user already exists
      let user = await User.findOne({ email: TEST_USER_EMAIL });
      
      if (!user) {
        user = new User({
          firstName: 'Test',
          lastName: 'User',
          email: TEST_USER_EMAIL,
          password: TEST_USER_PASSWORD,
          phone: '+1234567890',
          isEmailVerified: true,
          role: 'user'
        });
        
        await user.save();
        console.log('✅ Created test user');
      } else {
        console.log('ℹ️  Test user already exists');
      }
      
      this.testUserId = user._id;
      return user;
    } catch (error) {
      console.error('❌ Failed to create test user:', error);
      throw error;
    }
  }

  async testDiscoverySessionCreation() {
    try {
      console.log('\n🧪 Testing Discovery Session Creation...');
      
      const sessionData = {
        userId: this.testUserId,
        sessionType: 'multi_domain',
        domains: [
          { domain: 'example.com' },
          { domain: 'test.org' },
          { domain: 'demo.net' }
        ],
        formData: {
          firstName: 'John',
          lastName: 'Doe',
          nickName: 'johnd',
          useNickName: true,
          usePersonalInfo: true,
          useAdvancedEmails: true
        },
        config: {
          maxEmailsPerDomain: 50,
          confidenceThreshold: 25,
          autoVerify: false,
          verificationLimit: 10
        },
        progress: {
          totalDomains: 3
        }
      };

      const session = new DiscoverySession(sessionData);
      await session.save();
      
      this.testSessionId = session._id;
      console.log('✅ Discovery session created:', session._id);
      
      // Test session methods
      await session.startProcessing();
      console.log('✅ Session started processing');
      
      // Test domain completion
      await session.completeDomain(0, 15);
      console.log('✅ First domain completed');
      
      await session.completeDomain(1, 12);
      console.log('✅ Second domain completed');
      
      await session.completeDomain(2, 8);
      console.log('✅ Third domain completed');
      
      console.log('✅ Session status:', session.status);
      console.log('✅ Progress:', session.progress);
      
      return session;
    } catch (error) {
      console.error('❌ Discovery session test failed:', error);
      throw error;
    }
  }

  async testEmailDiscoveryCreation() {
    try {
      console.log('\n🧪 Testing Email Discovery Creation...');
      
      const emails = [
        {
          email: 'john.doe@example.com',
          domain: 'example.com',
          confidence: 85,
          generationMethod: 'personal_info',
          discoveredBy: this.testUserId,
          discoverySession: this.testSessionId,
          metadata: {
            firstName: 'John',
            lastName: 'Doe'
          }
        },
        {
          email: 'johndoe@example.com',
          domain: 'example.com',
          confidence: 80,
          generationMethod: 'personal_info',
          discoveredBy: this.testUserId,
          discoverySession: this.testSessionId,
          metadata: {
            firstName: 'John',
            lastName: 'Doe'
          }
        },
        {
          email: 'johnd@example.com',
          domain: 'example.com',
          confidence: 75,
          generationMethod: 'nickname',
          discoveredBy: this.testUserId,
          discoverySession: this.testSessionId,
          metadata: {
            firstName: 'John',
            lastName: 'Doe',
            nickName: 'johnd'
          }
        },
        {
          email: 'jane.smith@test.org',
          domain: 'test.org',
          confidence: 90,
          generationMethod: 'custom_names',
          discoveredBy: this.testUserId,
          discoverySession: this.testSessionId,
          metadata: {
            firstName: 'Jane',
            lastName: 'Smith'
          }
        },
        {
          email: 'admin@demo.net',
          domain: 'demo.net',
          confidence: 70,
          generationMethod: 'advanced_patterns',
          discoveredBy: this.testUserId,
          discoverySession: this.testSessionId,
          metadata: {
            firstName: 'Admin',
            lastName: 'User'
          }
        }
      ];

      const emailDocuments = await EmailDiscovery.insertMany(emails);
      this.testEmailIds = emailDocuments.map(doc => doc._id);
      
      console.log('✅ Created', emailDocuments.length, 'email discoveries');
      
      return emailDocuments;
    } catch (error) {
      console.error('❌ Email discovery creation test failed:', error);
      throw error;
    }
  }

  async testEmailDiscoveryQueries() {
    try {
      console.log('\n🧪 Testing Email Discovery Queries...');
      
      // Test findByDomain
      const exampleEmails = await EmailDiscovery.findByDomain('example.com', this.testUserId);
      console.log('✅ findByDomain - example.com:', exampleEmails.length, 'emails');
      
      // Test findVerified
      const verifiedEmails = await EmailDiscovery.findVerified(this.testUserId);
      console.log('✅ findVerified:', verifiedEmails.length, 'emails');
      
      // Test getStats
      const stats = await EmailDiscovery.getStats(this.testUserId);
      console.log('✅ getStats:', stats);
      
      return { exampleEmails, verifiedEmails, stats };
    } catch (error) {
      console.error('❌ Email discovery queries test failed:', error);
      throw error;
    }
  }

  async testDiscoverySessionQueries() {
    try {
      console.log('\n🧪 Testing Discovery Session Queries...');
      
      // Test findActive
      const activeSessions = await DiscoverySession.findActive(this.testUserId);
      console.log('✅ findActive:', activeSessions.length, 'sessions');
      
      // Test findCompleted
      const completedSessions = await DiscoverySession.findCompleted(this.testUserId);
      console.log('✅ findCompleted:', completedSessions.length, 'sessions');
      
      // Test getUserStats
      const userStats = await DiscoverySession.getUserStats(this.testUserId);
      console.log('✅ getUserStats:', userStats);
      
      return { activeSessions, completedSessions, userStats };
    } catch (error) {
      console.error('❌ Discovery session queries test failed:', error);
      throw error;
    }
  }

  async testEmailVerification() {
    try {
      console.log('\n🧪 Testing Email Verification...');
      
      // Test updating verification for an email
      const emailToVerify = await EmailDiscovery.findById(this.testEmailIds[0]);
      
      const verificationData = {
        deliverable: true,
        syntax: {
          valid: true,
          username: 'john.doe',
          domain: 'example.com'
        },
        smtp: {
          hostExists: true,
          fullInbox: false,
          catchAll: false,
          deliverable: true,
          disabled: false
        },
        disposable: false,
        roleAccount: false,
        free: false,
        hasMxRecords: true
      };
      
      await emailToVerify.updateVerification(verificationData);
      console.log('✅ Email verification updated');
      
      // Test marking email as error
      const emailToError = await EmailDiscovery.findById(this.testEmailIds[1]);
      await emailToError.markAsError('Test error message');
      console.log('✅ Email marked as error');
      
      // Check updated statuses
      const updatedEmail = await EmailDiscovery.findById(this.testEmailIds[0]);
      const errorEmail = await EmailDiscovery.findById(this.testEmailIds[1]);
      
      console.log('✅ Verified email status:', updatedEmail.status);
      console.log('✅ Error email status:', errorEmail.status);
      
      return { updatedEmail, errorEmail };
    } catch (error) {
      console.error('❌ Email verification test failed:', error);
      throw error;
    }
  }

  async testAggregations() {
    try {
      console.log('\n🧪 Testing Aggregations...');
      
      // Test domain aggregation
      const domainStats = await EmailDiscovery.aggregate([
        {
          $match: {
            discoveredBy: mongoose.Types.ObjectId(this.testUserId),
            isDeleted: false
          }
        },
        {
          $group: {
            _id: '$domain',
            emailCount: { $sum: 1 },
            averageConfidence: { $avg: '$confidence' },
            methods: { $addToSet: '$generationMethod' }
          }
        },
        {
          $sort: { emailCount: -1 }
        }
      ]);
      
      console.log('✅ Domain aggregation:', domainStats);
      
      // Test confidence distribution
      const confidenceDistribution = await EmailDiscovery.aggregate([
        {
          $match: {
            discoveredBy: mongoose.Types.ObjectId(this.testUserId),
            isDeleted: false
          }
        },
        {
          $bucket: {
            groupBy: '$confidence',
            boundaries: [0, 25, 50, 75, 100],
            default: 'Other',
            output: {
              count: { $sum: 1 },
              emails: { $push: '$email' }
            }
          }
        }
      ]);
      
      console.log('✅ Confidence distribution:', confidenceDistribution);
      
      return { domainStats, confidenceDistribution };
    } catch (error) {
      console.error('❌ Aggregations test failed:', error);
      throw error;
    }
  }

  async runAllTests() {
    try {
      console.log('🚀 Starting Email Discovery System Tests...\n');
      
      await this.connect();
      await this.createTestUser();
      await this.testDiscoverySessionCreation();
      await this.testEmailDiscoveryCreation();
      await this.testEmailDiscoveryQueries();
      await this.testDiscoverySessionQueries();
      await this.testEmailVerification();
      await this.testAggregations();
      
      console.log('\n🎉 All tests completed successfully!');
      
    } catch (error) {
      console.error('\n💥 Test suite failed:', error);
    } finally {
      await this.cleanup();
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new EmailDiscoveryTester();
  tester.runAllTests();
}

module.exports = EmailDiscoveryTester;
