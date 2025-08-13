const mongoose = require('mongoose');

// Schema for discovery sessions
const discoverySessionSchema = new mongoose.Schema({
  // User who initiated the session
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Session type
  sessionType: {
    type: String,
    enum: ['single_domain', 'multi_domain'],
    required: true
  },
  
  // Session status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  
  // Domain information
  domains: [{
    domain: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'error'],
      default: 'pending'
    },
    emailsCount: {
      type: Number,
      default: 0
    },
    errorMessage: String,
    startedAt: Date,
    completedAt: Date
  }],
  
  // Form data used for discovery
  formData: {
    firstName: String,
    lastName: String,
    nickName: String,
    middleName: String,
    customName: String,
    useNickName: Boolean,
    useCustomNames: Boolean,
    usePersonalInfo: Boolean,
    useAdvancedEmails: Boolean,
    selectedCustomNames: [String]
  },
  
  // Processing configuration
  config: {
    maxEmailsPerDomain: {
      type: Number,
      default: 100
    },
    confidenceThreshold: {
      type: Number,
      default: 25,
      min: 0,
      max: 100
    },
    autoVerify: {
      type: Boolean,
      default: false
    },
    verificationLimit: {
      type: Number,
      default: 10
    }
  },
  
  // Progress tracking
  progress: {
    totalDomains: {
      type: Number,
      required: true
    },
    processedDomains: {
      type: Number,
      default: 0
    },
    currentDomainIndex: {
      type: Number,
      default: 0
    },
    totalEmailsDiscovered: {
      type: Number,
      default: 0
    },
    totalEmailsVerified: {
      type: Number,
      default: 0
    }
  },
  
  // Webhook information
  webhook: {
    url: String,
    enabled: {
      type: Boolean,
      default: false
    },
    lastNotification: Date,
    notificationCount: {
      type: Number,
      default: 0
    }
  },
  
  // Error tracking
  errors: [{
    domain: String,
    error: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Performance metrics
  metrics: {
    startTime: {
      type: Date,
      default: Date.now
    },
    endTime: Date,
    totalDuration: Number, // in milliseconds
    averageTimePerDomain: Number, // in milliseconds
    emailsPerSecond: Number
  },
  
  // Session metadata
  metadata: {
    userAgent: String,
    ipAddress: String,
    source: {
      type: String,
      enum: ['web', 'api', 'webhook'],
      default: 'web'
    }
  },
  
  // Timestamps
  startedAt: {
    type: Date,
    default: Date.now
  },
  
  completedAt: Date,
  
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for performance
discoverySessionSchema.index({ userId: 1, startedAt: -1 });
discoverySessionSchema.index({ status: 1, startedAt: -1 });
discoverySessionSchema.index({ sessionType: 1, status: 1 });
discoverySessionSchema.index({ 'domains.domain': 1 });

// Virtual for current domain
discoverySessionSchema.virtual('currentDomain').get(function() {
  if (this.progress.currentDomainIndex < this.domains.length) {
    return this.domains[this.progress.currentDomainIndex];
  }
  return null;
});

// Virtual for completion percentage
discoverySessionSchema.virtual('completionPercentage').get(function() {
  if (this.progress.totalDomains === 0) return 0;
  return Math.round((this.progress.processedDomains / this.progress.totalDomains) * 100);
});

// Virtual for is active
discoverySessionSchema.virtual('isActive').get(function() {
  return this.status === 'processing' || this.status === 'pending';
});

// Method to start processing
discoverySessionSchema.methods.startProcessing = function() {
  this.status = 'processing';
  this.progress.processedDomains = 0;
  this.progress.currentDomainIndex = 0;
  this.metrics.startTime = new Date();
  return this.save();
};

// Method to complete domain processing
discoverySessionSchema.methods.completeDomain = function(domainIndex, emailsCount, errorMessage = null) {
  if (domainIndex < this.domains.length) {
    const domain = this.domains[domainIndex];
    domain.status = errorMessage ? 'error' : 'completed';
    domain.emailsCount = emailsCount;
    domain.errorMessage = errorMessage;
    domain.completedAt = new Date();
    
    this.progress.processedDomains += 1;
    this.progress.totalEmailsDiscovered += emailsCount;
    
    if (errorMessage) {
      this.errors.push({
        domain: domain.domain,
        error: errorMessage,
        timestamp: new Date()
      });
    }
    
    // Move to next domain
    this.progress.currentDomainIndex = domainIndex + 1;
    
    // Check if all domains are processed
    if (this.progress.processedDomains >= this.progress.totalDomains) {
      this.completeSession();
    }
    
    return this.save();
  }
  return Promise.reject(new Error('Invalid domain index'));
};

// Method to complete session
discoverySessionSchema.methods.completeSession = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  this.metrics.endTime = new Date();
  this.metrics.totalDuration = this.metrics.endTime - this.metrics.startTime;
  
  if (this.progress.totalDomains > 0) {
    this.metrics.averageTimePerDomain = this.metrics.totalDuration / this.progress.totalDomains;
  }
  
  if (this.metrics.totalDuration > 0) {
    this.metrics.emailsPerSecond = (this.progress.totalEmailsDiscovered / this.metrics.totalDuration) * 1000;
  }
  
  return this.save();
};

// Method to fail session
discoverySessionSchema.methods.failSession = function(errorMessage) {
  this.status = 'failed';
  this.completedAt = new Date();
  this.metrics.endTime = new Date();
  this.metrics.totalDuration = this.metrics.endTime - this.metrics.startTime;
  
  if (errorMessage) {
    this.errors.push({
      domain: 'session',
      error: errorMessage,
      timestamp: new Date()
    });
  }
  
  return this.save();
};

// Method to cancel session
discoverySessionSchema.methods.cancelSession = function() {
  this.status = 'cancelled';
  this.completedAt = new Date();
  this.metrics.endTime = new Date();
  this.metrics.totalDuration = this.metrics.endTime - this.metrics.startTime;
  return this.save();
};

// Method to update progress
discoverySessionSchema.methods.updateProgress = function(domainIndex, emailsCount, verifiedCount = 0) {
  if (domainIndex < this.domains.length) {
    const domain = this.domains[domainIndex];
    domain.emailsCount = emailsCount;
    this.progress.totalEmailsVerified += verifiedCount;
    return this.save();
  }
  return Promise.reject(new Error('Invalid domain index'));
};

// Static method to find active sessions
discoverySessionSchema.statics.findActive = function(userId) {
  return this.find({
    userId,
    status: { $in: ['pending', 'processing'] },
    isDeleted: false
  }).sort({ startedAt: -1 });
};

// Static method to find completed sessions
discoverySessionSchema.statics.findCompleted = function(userId, limit = 10) {
  return this.find({
    userId,
    status: 'completed',
    isDeleted: false
  }).sort({ completedAt: -1 }).limit(limit);
};

// Static method to get user statistics
discoverySessionSchema.statics.getUserStats = function(userId) {
  return this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        isDeleted: false
      }
    },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        completedSessions: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        failedSessions: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        totalEmailsDiscovered: { $sum: '$progress.totalEmailsDiscovered' },
        totalEmailsVerified: { $sum: '$progress.totalEmailsVerified' },
        averageSessionDuration: { $avg: '$metrics.totalDuration' }
      }
    },
    {
      $project: {
        totalSessions: 1,
        completedSessions: 1,
        failedSessions: 1,
        successRate: {
          $round: [
            { $multiply: [{ $divide: ['$completedSessions', '$totalSessions'] }, 100] },
            2
          ]
        },
        totalEmailsDiscovered: 1,
        totalEmailsVerified: 1,
        averageSessionDuration: { $round: ['$averageSessionDuration', 0] }
      }
    }
  ]);
};

module.exports = mongoose.model('DiscoverySession', discoverySessionSchema);
