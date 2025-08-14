const NeverBounce = require('neverbounce').default;

// Initialize NeverBounce client
const client = new NeverBounce({apiKey: "private_57b5e80d38d355e2294629258bc87f44"});

class NeverBounceVerificationService {
  constructor() {
    this.usageCount = 0;
    this.sessionStartTime = Date.now();
  }

  // Reset usage counter for new sessions
  resetSession() {
    this.usageCount = 0;
    this.sessionStartTime = Date.now();
  }

  // NeverBounce verification
  async verifyEmail(email) {
    try {
      console.log(`\n🔍 Verifying email: ${email}`);
      console.log(`📊 Usage count: ${this.usageCount + 1}`);
      
      const result = await client.single.check(email);
      this.usageCount++;
      
      // Log raw NeverBounce response
      console.log(`\n📋 RAW NEVERBOUNCE RESPONSE for ${email}:`);
      console.log(JSON.stringify(result, null, 2));
      
      // Map NeverBounce result to our format
      const mappedResult = {
        email,
        verificationMethod: 'neverbounce',
        cost: 1, // 1 credit per verification
        reachable: this.mapNeverBounceStatus(result.response.result),
        syntax: {
          username: email.split('@')[0],
          domain: email.split('@')[1],
          valid: result.response.result !== 'invalid'
        },
        smtp: {
          host_exists: result.response.result !== 'invalid',
          full_inbox: result.response.result === 'catchall',
          catch_all: result.response.result === 'catchall',
          deliverable: ['valid', 'catchall'].includes(result.response.result),
          disabled: result.response.result === 'invalid'
        },
        gravatar: null, // NeverBounce doesn't provide this
        suggestion: result.response.suggested_correction || '',
        disposable: result.response.result === 'disposable',
        role_account: result.response.flags && result.response.flags.includes('role_account'),
        free: result.response.flags && result.response.flags.includes('free_email_host'),
        has_mx_records: result.response.flags && result.response.flags.includes('has_dns'),
        neverbounceResult: result // Keep original result for debugging
      };

      console.log(`\n✅ MAPPED RESULT for ${email}:`);
      console.log(JSON.stringify(mappedResult, null, 2));

      return mappedResult;
    } catch (error) {
      console.error(`\n❌ NeverBounce verification failed for ${email}:`, error);
      this.usageCount++; // Still count as usage even if it fails
      return {
        email,
        verificationMethod: 'neverbounce',
        error: error.message,
        cost: 1
      };
    }
  }

  // Map NeverBounce status to our format
  mapNeverBounceStatus(status) {
    switch (status) {
      case 'valid':
        return 'yes';
      case 'invalid':
        return 'no';
      case 'catchall':
        return 'yes'; // Catchall emails are reachable
      case 'disposable':
        return 'yes'; // Disposable emails are reachable
      case 'unknown':
        return 'unknown';
      default:
        return 'unknown';
    }
  }

  // Get current usage statistics
  getUsageStats() {
    return {
      neverbounceUsageCount: this.usageCount,
      sessionDuration: Date.now() - this.sessionStartTime
    };
  }

  // Batch verification
  async batchVerification(emailsWithConfidence, maxEmails = 10) {
    const results = [];
    const emailsToVerify = emailsWithConfidence.slice(0, maxEmails);

    console.log(`\n🚀 Starting NeverBounce batch verification for ${emailsToVerify.length} emails`);

    for (const emailData of emailsToVerify) {
      const { email, confidence } = emailData;
      
      try {
        const result = await this.verifyEmail(email);
        results.push(result);
        
        // Add delay between requests to be respectful to API
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`\n❌ Verification failed for ${email}:`, error);
        results.push({
          email,
          verificationMethod: 'error',
          error: error.message,
          cost: 0
        });
      }
    }

    console.log(`\n📊 Batch verification completed. Usage stats:`, this.getUsageStats());
    return results;
  }
}

module.exports = NeverBounceVerificationService; 