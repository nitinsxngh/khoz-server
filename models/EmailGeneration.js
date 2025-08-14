const mongoose = require('mongoose');

const emailGenerationSchema = new mongoose.Schema({
  // User who generated the emails (if authenticated)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional for anonymous users
  },
  
  // Input data used for generation
  inputData: {
    firstName: String,
    lastName: String,
    middleName: String,
    nickName: String,
    domain: {
      type: String,
      required: true
    },
    useNickName: Boolean,
    useCustomNames: Boolean,
    usePersonalInfo: Boolean,
    useAdvancedEmails: Boolean,
    selectedCustomNames: [String],
    domainsFromFile: [String]
  },
  
  // Webhook/Perplexity AI response data
  webhookResponse: {
    output: String,
    domain: String,
    timestamp: Date,
    note: String,
    rawData: mongoose.Schema.Types.Mixed
  },
  
  // Generated emails with confidence scores
  generatedEmails: [{
    email: {
      type: String,
      required: true
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    pattern: {
      type: String,
      enum: ['high', 'medium', 'low', 'advanced', 'custom'],
      required: true
    },
    source: {
      type: String,
      enum: ['webhook', 'custom_names', 'personal_info'],
      required: true
    }
  }],
  
  // Processing metadata
  processingMetadata: {
    totalEmails: Number,
    uniqueEmails: Number,
    processingTime: Number, // in milliseconds
    domainsProcessed: Number,
    status: {
      type: String,
      enum: ['generated', 'verified', 'error'],
      default: 'generated'
    },
    error: String
  },
  
  // Verification results (if emails were verified)
  verificationResults: [{
    email: String,
    reachable: {
      type: String,
      enum: ['unknown', 'yes', 'no']
    },
    syntax: {
      username: String,
      domain: String,
      valid: Boolean
    },
    smtp: {
      host_exists: Boolean,
      full_inbox: Boolean,
      catch_all: Boolean,
      deliverable: Boolean,
      disabled: Boolean
    },
    gravatar: String,
    suggestion: String,
    disposable: Boolean,
    role_account: Boolean,
    free: Boolean,
    has_mx_records: Boolean,
    verificationMethod: {
      type: String,
      enum: ['free', 'neverbounce', 'error']
    },
    cost: Number,
    neverbounceResult: mongoose.Schema.Types.Mixed
  }],
  
  // Statistics
  statistics: {
    totalVerificationCost: {
      type: Number,
      default: 0
    },
    emailsVerified: {
      type: Number,
      default: 0
    },
    deliverableEmails: {
      type: Number,
      default: 0
    },
    undeliverableEmails: {
      type: Number,
      default: 0
    }
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Expiration (optional - for data retention policies)
  expiresAt: {
    type: Date,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
emailGenerationSchema.index({ userId: 1, createdAt: -1 });
emailGenerationSchema.index({ domain: 1, createdAt: -1 });
emailGenerationSchema.index({ 'processingMetadata.status': 1 });

// Virtual for total emails count
emailGenerationSchema.virtual('totalEmailsCount').get(function() {
  return this.generatedEmails ? this.generatedEmails.length : 0;
});

// Virtual for verification completion status
emailGenerationSchema.virtual('verificationComplete').get(function() {
  if (!this.verificationResults || this.verificationResults.length === 0) {
    return false;
  }
  return this.verificationResults.length === this.generatedEmails.length;
});

// Pre-save middleware to update statistics
emailGenerationSchema.pre('save', function(next) {
  // Update processing metadata
  if (this.generatedEmails) {
    this.processingMetadata.totalEmails = this.generatedEmails.length;
    this.processingMetadata.uniqueEmails = new Set(this.generatedEmails.map(e => e.email)).size;
  }
  
  // Update verification statistics
  if (this.verificationResults) {
    this.statistics.emailsVerified = this.verificationResults.length;
    this.statistics.deliverableEmails = this.verificationResults.filter(r => r.reachable === 'yes').length;
    this.statistics.undeliverableEmails = this.verificationResults.filter(r => r.reachable === 'no').length;
  }
  
  this.updatedAt = new Date();
  next();
});

// Static method to find by user ID
emailGenerationSchema.statics.findByUserId = function(userId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

// Static method to find by domain
emailGenerationSchema.statics.findByDomain = function(domain) {
  return this.find({ 'inputData.domain': domain }).sort({ createdAt: -1 });
};

// Static method to find completed generations
emailGenerationSchema.statics.findCompleted = function() {
  return this.find({ 'processingMetadata.status': 'verified' });
};

// Instance method to add verification results
emailGenerationSchema.methods.addVerificationResults = function(results) {
  this.verificationResults = results;
  this.processingMetadata.status = 'verified';
  return this.save();
};

// Instance method to update processing status
emailGenerationSchema.methods.updateStatus = function(status, error = null) {
  this.processingMetadata.status = status;
  if (error) {
    this.processingMetadata.error = error;
  }
  return this.save();
};

// Instance method to calculate total verification cost
emailGenerationSchema.methods.calculateTotalCost = function() {
  if (!this.verificationResults) return 0;
  
  return this.verificationResults.reduce((total, result) => {
    return total + (result.cost || 0);
  }, 0);
};

module.exports = mongoose.model('EmailGeneration', emailGenerationSchema);
