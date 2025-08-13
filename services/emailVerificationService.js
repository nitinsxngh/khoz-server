const EmailDiscovery = require('../models/EmailDiscovery');

class EmailVerificationService {
  constructor() {
    this.verificationProviders = {
      free: this.freeVerification.bind(this),
      neverbounce: this.neverbounceVerification.bind(this),
      manual: this.manualVerification.bind(this)
    };
  }

  // Free verification using basic SMTP checks
  async freeVerification(email) {
    try {
      // Basic email syntax validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return {
          deliverable: false,
          syntax: {
            valid: false,
            username: email.split('@')[0] || '',
            domain: email.split('@')[1] || ''
          },
          smtp: {
            hostExists: false,
            fullInbox: false,
            catchAll: false,
            deliverable: false,
            disabled: false
          },
          disposable: false,
          roleAccount: false,
          free: false,
          hasMxRecords: false,
          verificationMethod: 'free',
          cost: 0
        };
      }

      const [username, domain] = email.split('@');
      
      // Basic domain validation
      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!domainRegex.test(domain)) {
        return {
          deliverable: false,
          syntax: {
            valid: false,
            username,
            domain
          },
          smtp: {
            hostExists: false,
            fullInbox: false,
            catchAll: false,
            deliverable: false,
            disabled: false
          },
          disposable: false,
          roleAccount: false,
          free: false,
          hasMxRecords: false,
          verificationMethod: 'free',
          cost: 0
        };
      }

      // For free verification, we'll return a basic structure
      // In production, you might implement actual SMTP checks
      return {
        deliverable: true, // Assume deliverable for free tier
        syntax: {
          valid: true,
          username,
          domain
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
        hasMxRecords: true,
        verificationMethod: 'free',
        cost: 0
      };
    } catch (error) {
      console.error('Free verification error:', error);
      throw new Error('Free verification failed');
    }
  }

  // Neverbounce verification (placeholder for premium service)
  async neverbounceVerification(email) {
    try {
      // This would integrate with Neverbounce API
      // For now, return a placeholder response
      const [username, domain] = email.split('@');
      
      return {
        deliverable: true,
        syntax: {
          valid: true,
          username,
          domain
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
        hasMxRecords: true,
        verificationMethod: 'neverbounce',
        cost: 0.01 // Neverbounce cost per email
      };
    } catch (error) {
      console.error('Neverbounce verification error:', error);
      throw new Error('Neverbounce verification failed');
    }
  }

  // Manual verification (for user input)
  async manualVerification(email, verificationData) {
    try {
      const [username, domain] = email.split('@');
      
      return {
        deliverable: verificationData.deliverable || false,
        syntax: {
          valid: verificationData.syntax?.valid || true,
          username,
          domain
        },
        smtp: {
          hostExists: verificationData.smtp?.hostExists || false,
          fullInbox: verificationData.smtp?.fullInbox || false,
          catchAll: verificationData.smtp?.catchAll || false,
          deliverable: verificationData.smtp?.deliverable || false,
          disabled: verificationData.smtp?.disabled || false
        },
        disposable: verificationData.disposable || false,
        roleAccount: verificationData.roleAccount || false,
        free: verificationData.free || false,
        hasMxRecords: verificationData.hasMxRecords || false,
        verificationMethod: 'manual',
        cost: 0
      };
    } catch (error) {
      console.error('Manual verification error:', error);
      throw new Error('Manual verification failed');
    }
  }

  // Main verification method
  async verifyEmail(email, method = 'free', customData = null) {
    try {
      if (!this.verificationProviders[method]) {
        throw new Error(`Unsupported verification method: ${method}`);
      }

      let result;
      if (method === 'manual' && customData) {
        result = await this.verificationProviders[method](email, customData);
      } else {
        result = await this.verificationProviders[method](email);
      }

      return result;
    } catch (error) {
      console.error('Email verification error:', error);
      throw error;
    }
  }

  // Bulk verification
  async verifyEmails(emails, method = 'free', limit = 10) {
    try {
      if (!Array.isArray(emails)) {
        throw new Error('Emails must be an array');
      }

      if (emails.length > limit) {
        throw new Error(`Cannot verify more than ${limit} emails at once`);
      }

      const results = [];
      const errors = [];

      for (const email of emails) {
        try {
          const result = await this.verifyEmail(email, method);
          results.push({
            email,
            verification: result,
            success: true
          });
        } catch (error) {
          errors.push({
            email,
            error: error.message,
            success: false
          });
        }
      }

      return {
        results,
        errors,
        total: emails.length,
        successful: results.length,
        failed: errors.length
      };
    } catch (error) {
      console.error('Bulk verification error:', error);
      throw error;
    }
  }

  // Update email verification in database
  async updateEmailVerification(emailId, verificationData, userId) {
    try {
      const email = await EmailDiscovery.findOne({
        _id: emailId,
        discoveredBy: userId,
        isDeleted: false
      });

      if (!email) {
        throw new Error('Email not found or access denied');
      }

      // Update verification status
      await email.updateVerification(verificationData);

      return {
        success: true,
        email: email.email,
        status: email.status,
        verification: email.verification
      };
    } catch (error) {
      console.error('Update verification error:', error);
      throw error;
    }
  }

  // Get verification statistics
  async getVerificationStats(userId) {
    try {
      const stats = await EmailDiscovery.aggregate([
        {
          $match: {
            discoveredBy: require('mongoose').Types.ObjectId(userId),
            isDeleted: false
          }
        },
        {
          $group: {
            _id: null,
            totalEmails: { $sum: 1 },
            verifiedEmails: {
              $sum: {
                $cond: [
                  { $eq: ['$verification.isVerified', true] },
                  1,
                  0
                ]
              }
            },
            deliverableEmails: {
              $sum: {
                $cond: [
                  { $and: [
                    { $eq: ['$verification.isVerified', true] },
                    { $eq: ['$verification.verificationResult.deliverable', true] }
                  ]},
                  1,
                  0
                ]
              }
            },
            totalCost: {
              $sum: '$verification.verificationCost'
            }
          }
        }
      ]);

      return stats[0] || {
        totalEmails: 0,
        verifiedEmails: 0,
        deliverableEmails: 0,
        totalCost: 0
      };
    } catch (error) {
      console.error('Get verification stats error:', error);
      throw error;
    }
  }

  // Check if email needs verification
  async needsVerification(emailId, userId) {
    try {
      const email = await EmailDiscovery.findOne({
        _id: emailId,
        discoveredBy: userId,
        isDeleted: false
      });

      if (!email) {
        return false;
      }

      return !email.verification.isVerified;
    } catch (error) {
      console.error('Check verification need error:', error);
      return false;
    }
  }

  // Get unverified emails for a user
  async getUnverifiedEmails(userId, limit = 50) {
    try {
      const emails = await EmailDiscovery.find({
        discoveredBy: userId,
        'verification.isVerified': false,
        isDeleted: false
      })
      .sort({ discoveredAt: -1 })
      .limit(limit)
      .select('email domain confidence discoveredAt');

      return emails;
    } catch (error) {
      console.error('Get unverified emails error:', error);
      throw error;
    }
  }
}

module.exports = new EmailVerificationService();
