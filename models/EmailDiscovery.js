const mongoose = require('mongoose');

// Schema for individual email discovery
const emailDiscoverySchema = new mongoose.Schema({
  // Basic email information
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  
  // Domain information
  domain: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  
  // Confidence score (0-100)
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0
  },
  
  // Email generation method
  generationMethod: {
    type: String,
    enum: ['personal_info', 'nickname', 'custom_names', 'advanced_patterns'],
    required: true
  },
  
  // User who discovered this email
  discoveredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Discovery session information
  discoverySession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiscoverySession',
    required: true
  },
  
  // Verification status
  verification: {
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedAt: Date,
    verificationResult: {
      deliverable: Boolean,
      syntax: {
        valid: Boolean,
        username: String,
        domain: String
      },
      smtp: {
        hostExists: Boolean,
        fullInbox: Boolean,
        catchAll: Boolean,
        deliverable: Boolean,
        disabled: Boolean
      },
      disposable: Boolean,
      roleAccount: Boolean,
      free: Boolean,
      hasMxRecords: Boolean
    },
    verificationMethod: {
      type: String,
      enum: ['free', 'neverbounce', 'manual'],
      default: 'free'
    },
    verificationCost: {
      type: Number,
      default: 0
    }
  },
  
  // Metadata
  metadata: {
    firstName: String,
    lastName: String,
    nickName: String,
    middleName: String,
    customName: String
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['discovered', 'verified', 'invalid', 'error'],
    default: 'discovered'
  },
  
  // Timestamps
  discoveredAt: {
    type: Date,
    default: Date.now
  },
  
  lastVerifiedAt: Date,
  
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for performance
emailDiscoverySchema.index({ email: 1, domain: 1 });
emailDiscoverySchema.index({ discoveredBy: 1, discoveredAt: -1 });
emailDiscoverySchema.index({ domain: 1, confidence: -1 });
emailDiscoverySchema.index({ status: 1, discoveredAt: -1 });
emailDiscoverySchema.index({ 'verification.isVerified': 1 });

// Virtual for full name
emailDiscoverySchema.virtual('fullName').get(function() {
  const parts = [];
  if (this.metadata.firstName) parts.push(this.metadata.firstName);
  if (this.metadata.middleName) parts.push(this.metadata.middleName);
  if (this.metadata.lastName) parts.push(this.metadata.lastName);
  return parts.join(' ').trim();
});

// Method to update verification status
emailDiscoverySchema.methods.updateVerification = function(verificationData) {
  this.verification.isVerified = true;
  this.verification.verifiedAt = new Date();
  this.verification.verificationResult = verificationData;
  this.lastVerifiedAt = new Date();
  
  if (verificationData.deliverable) {
    this.status = 'verified';
  } else {
    this.status = 'invalid';
  }
  
  return this.save();
};

// Method to mark as error
emailDiscoverySchema.methods.markAsError = function(errorMessage) {
  this.status = 'error';
  this.metadata.errorMessage = errorMessage;
  return this.save();
};

// Static method to find emails by domain
emailDiscoverySchema.statics.findByDomain = function(domain, userId) {
  return this.find({
    domain: domain.toLowerCase(),
    discoveredBy: userId,
    isDeleted: false
  }).sort({ confidence: -1, discoveredAt: -1 });
};

// Static method to find verified emails
emailDiscoverySchema.statics.findVerified = function(userId, domain = null) {
  const query = {
    discoveredBy: userId,
    'verification.isVerified': true,
    'verification.verificationResult.deliverable': true,
    isDeleted: false
  };
  
  if (domain) {
    query.domain = domain.toLowerCase();
  }
  
  return this.find(query).sort({ confidence: -1, discoveredAt: -1 });
};

// Static method to get discovery statistics
emailDiscoverySchema.statics.getStats = function(userId) {
  return this.aggregate([
    {
      $match: {
        discoveredBy: mongoose.Types.ObjectId(userId),
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
              { $and: [
                { $eq: ['$verification.isVerified', true] },
                { $eq: ['$verification.verificationResult.deliverable', true] }
              ]},
              1,
              0
            ]
          }
        },
        totalDomains: { $addToSet: '$domain' },
        averageConfidence: { $avg: '$confidence' }
      }
    },
    {
      $project: {
        totalEmails: 1,
        verifiedEmails: 1,
        totalDomains: { $size: '$totalDomains' },
        averageConfidence: { $round: ['$averageConfidence', 2] }
      }
    }
  ]);
};

module.exports = mongoose.model('EmailDiscovery', emailDiscoverySchema);
