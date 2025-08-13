const EmailDiscovery = require('../models/EmailDiscovery');
const DiscoverySession = require('../models/DiscoverySession');
const { validationResult } = require('express-validator');

// Helper function to generate emails based on form data
const generateEmails = (formData, domain) => {
  const emails = [];
  const { firstName, lastName, nickName, middleName, customName, useNickName, useCustomNames, usePersonalInfo, useAdvancedEmails, selectedCustomNames } = formData;
  
  // Personal info combinations
  if (usePersonalInfo) {
    if (firstName && lastName) {
      emails.push({ email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`, confidence: 85, generationMethod: 'personal_info' });
      emails.push({ email: `${firstName.toLowerCase()}${lastName.toLowerCase()}@${domain}`, confidence: 80, generationMethod: 'personal_info' });
      emails.push({ email: `${firstName.toLowerCase()[0]}${lastName.toLowerCase()}@${domain}`, confidence: 75, generationMethod: 'personal_info' });
      emails.push({ email: `${firstName.toLowerCase()}_${lastName.toLowerCase()}@${domain}`, confidence: 70, generationMethod: 'personal_info' });
    }
    
    if (firstName) {
      emails.push({ email: `${firstName.toLowerCase()}@${domain}`, confidence: 60, generationMethod: 'personal_info' });
    }
    
    if (lastName) {
      emails.push({ email: `${lastName.toLowerCase()}@${domain}`, confidence: 55, generationMethod: 'personal_info' });
    }
    
    if (firstName && middleName && lastName) {
      emails.push({ email: `${firstName.toLowerCase()}.${middleName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`, confidence: 65, generationMethod: 'personal_info' });
    }
  }
  
  // Nickname combinations
  if (useNickName && nickName) {
    emails.push({ email: `${nickName.toLowerCase()}@${domain}`, confidence: 70, generationMethod: 'nickname' });
    if (lastName) {
      emails.push({ email: `${nickName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`, confidence: 65, generationMethod: 'nickname' });
    }
  }
  
  // Custom names
  if (useCustomNames && customName) {
    emails.push({ email: `${customName.toLowerCase()}@${domain}`, confidence: 90, generationMethod: 'custom_names' });
  }
  
  // Selected custom names
  if (selectedCustomNames && selectedCustomNames.length > 0) {
    selectedCustomNames.forEach(name => {
      emails.push({ email: `${name.toLowerCase()}@${domain}`, confidence: 90, generationMethod: 'custom_names' });
    });
  }
  
  // Advanced patterns
  if (useAdvancedEmails) {
    if (firstName && lastName) {
      emails.push({ email: `${firstName.toLowerCase()}-${lastName.toLowerCase()}@${domain}`, confidence: 70, generationMethod: 'advanced_patterns' });
      emails.push({ email: `${firstName.toLowerCase()}${lastName.toLowerCase()[0]}@${domain}`, confidence: 65, generationMethod: 'advanced_patterns' });
      emails.push({ email: `${firstName.toLowerCase()[0]}.${lastName.toLowerCase()}@${domain}`, confidence: 75, generationMethod: 'advanced_patterns' });
    }
    
    if (firstName) {
      emails.push({ email: `${firstName.toLowerCase()}1@${domain}`, confidence: 50, generationMethod: 'advanced_patterns' });
      emails.push({ email: `${firstName.toLowerCase()}2@${domain}`, confidence: 45, generationMethod: 'advanced_patterns' });
    }
  }
  
  // Remove duplicates and sort by confidence
  const uniqueEmails = emails.filter((email, index, self) => 
    index === self.findIndex(e => e.email === email.email)
  );
  
  return uniqueEmails.sort((a, b) => b.confidence - a.confidence);
};

// Start email discovery session
exports.startDiscovery = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { domains, formData, config = {} } = req.body;
    const userId = req.user.id;
    
    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one domain is required'
      });
    }
    
    // Create discovery session
    const session = new DiscoverySession({
      userId,
      sessionType: domains.length === 1 ? 'single_domain' : 'multi_domain',
      domains: domains.map(domain => ({ domain })),
      formData,
      config: {
        maxEmailsPerDomain: config.maxEmailsPerDomain || 100,
        confidenceThreshold: config.confidenceThreshold || 25,
        autoVerify: config.autoVerify || false,
        verificationLimit: config.verificationLimit || 10
      },
      progress: {
        totalDomains: domains.length
      },
      metadata: {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        source: 'web'
      }
    });
    
    await session.save();
    
    // Start processing
    await session.startProcessing();
    
    res.status(201).json({
      success: true,
      message: 'Discovery session started successfully',
      data: {
        sessionId: session._id,
        sessionType: session.sessionType,
        totalDomains: session.progress.totalDomains,
        status: session.status
      }
    });
    
  } catch (error) {
    console.error('Error starting discovery:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start discovery session',
      message: error.message
    });
  }
};

// Process single domain discovery
exports.processDomain = async (req, res) => {
  try {
    const { sessionId, domainIndex } = req.params;
    const userId = req.user.id;
    
    // Find and validate session
    const session = await DiscoverySession.findOne({
      _id: sessionId,
      userId,
      isDeleted: false
    });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Discovery session not found'
      });
    }
    
    if (session.status !== 'processing') {
      return res.status(400).json({
        success: false,
        error: 'Session is not in processing state'
      });
    }
    
    if (domainIndex >= session.domains.length) {
      return res.status(400).json({
        success: false,
        error: 'Invalid domain index'
      });
    }
    
    const domain = session.domains[domainIndex];
    if (domain.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Domain already processed or being processed'
      });
    }
    
    // Mark domain as processing
    domain.status = 'processing';
    domain.startedAt = new Date();
    await session.save();
    
    try {
      // Generate emails for this domain
      const generatedEmails = generateEmails(session.formData, domain.domain);
      
      // Filter by confidence threshold
      const filteredEmails = generatedEmails.filter(email => 
        email.confidence >= session.config.confidenceThreshold
      );
      
      // Limit emails per domain
      const limitedEmails = filteredEmails.slice(0, session.config.maxEmailsPerDomain);
      
      // Store discovered emails
      const emailDocuments = limitedEmails.map(emailData => ({
        email: emailData.email,
        domain: domain.domain,
        confidence: emailData.confidence,
        generationMethod: emailData.generationMethod,
        discoveredBy: userId,
        discoverySession: sessionId,
        metadata: {
          firstName: session.formData.firstName,
          lastName: session.formData.lastName,
          nickName: session.formData.nickName,
          middleName: session.formData.middleName,
          customName: session.formData.customName
        }
      }));
      
      if (emailDocuments.length > 0) {
        await EmailDiscovery.insertMany(emailDocuments);
      }
      
      // Complete domain processing
      await session.completeDomain(parseInt(domainIndex), limitedEmails.length);
      
      res.json({
        success: true,
        message: 'Domain processed successfully',
        data: {
          domain: domain.domain,
          emailsDiscovered: limitedEmails.length,
          emails: limitedEmails.map(e => ({
            email: e.email,
            confidence: e.confidence,
            generationMethod: e.generationMethod
          }))
        }
      });
      
    } catch (domainError) {
      // Mark domain as failed
      await session.completeDomain(parseInt(domainIndex), 0, domainError.message);
      
      res.status(500).json({
        success: false,
        error: 'Failed to process domain',
        message: domainError.message
      });
    }
    
  } catch (error) {
    console.error('Error processing domain:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process domain',
      message: error.message
    });
  }
};

// Get discovery session status
exports.getSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    
    const session = await DiscoverySession.findOne({
      _id: sessionId,
      userId,
      isDeleted: false
    }).populate('domains.domain');
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Discovery session not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        sessionId: session._id,
        sessionType: session.sessionType,
        status: session.status,
        progress: session.progress,
        domains: session.domains,
        metrics: session.metrics,
        startedAt: session.startedAt,
        completedAt: session.completedAt
      }
    });
    
  } catch (error) {
    console.error('Error getting session status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session status',
      message: error.message
    });
  }
};

// Get discovered emails for a session
exports.getSessionEmails = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { page = 1, limit = 50, domain, status, confidence } = req.query;
    const userId = req.user.id;
    
    // Validate session ownership
    const session = await DiscoverySession.findOne({
      _id: sessionId,
      userId,
      isDeleted: false
    });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Discovery session not found'
      });
    }
    
    // Build query
    const query = {
      discoverySession: sessionId,
      discoveredBy: userId,
      isDeleted: false
    };
    
    if (domain) query.domain = domain.toLowerCase();
    if (status) query.status = status;
    if (confidence) {
      const [min, max] = confidence.split('-').map(Number);
      if (max) {
        query.confidence = { $gte: min, $lte: max };
      } else {
        query.confidence = { $gte: min };
      }
    }
    
    // Execute query with pagination
    const skip = (page - 1) * limit;
    const emails = await EmailDiscovery.find(query)
      .sort({ confidence: -1, discoveredAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('discoverySession', 'sessionType status');
    
    const total = await EmailDiscovery.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        emails,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting session emails:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session emails',
      message: error.message
    });
  }
};

// Get user's discovery statistics
exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [emailStats, sessionStats] = await Promise.all([
      EmailDiscovery.getStats(userId),
      DiscoverySession.getUserStats(userId)
    ]);
    
    const stats = {
      emails: emailStats[0] || {
        totalEmails: 0,
        verifiedEmails: 0,
        totalDomains: 0,
        averageConfidence: 0
      },
      sessions: sessionStats[0] || {
        totalSessions: 0,
        completedSessions: 0,
        failedSessions: 0,
        successRate: 0,
        totalEmailsDiscovered: 0,
        totalEmailsVerified: 0,
        averageSessionDuration: 0
      }
    };
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user statistics',
      message: error.message
    });
  }
};

// Get user's discovery history
exports.getDiscoveryHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status, sessionType } = req.query;
    
    const query = {
      userId,
      isDeleted: false
    };
    
    if (status) query.status = status;
    if (sessionType) query.sessionType = sessionType;
    
    const skip = (page - 1) * limit;
    const sessions = await DiscoverySession.find(query)
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-formData -errors -metadata');
    
    const total = await DiscoverySession.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting discovery history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get discovery history',
      message: error.message
    });
  }
};

// Cancel active discovery session
exports.cancelSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    
    const session = await DiscoverySession.findOne({
      _id: sessionId,
      userId,
      status: { $in: ['pending', 'processing'] },
      isDeleted: false
    });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Active discovery session not found'
      });
    }
    
    await session.cancelSession();
    
    res.json({
      success: true,
      message: 'Discovery session cancelled successfully',
      data: {
        sessionId: session._id,
        status: session.status
      }
    });
    
  } catch (error) {
    console.error('Error cancelling session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel session',
      message: error.message
    });
  }
};

// Delete discovery session and associated emails
exports.deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    
    const session = await DiscoverySession.findOne({
      _id: sessionId,
      userId,
      isDeleted: false
    });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Discovery session not found'
      });
    }
    
    // Soft delete session
    session.isDeleted = true;
    await session.save();
    
    // Soft delete associated emails
    await EmailDiscovery.updateMany(
      { discoverySession: sessionId },
      { isDeleted: true }
    );
    
    res.json({
      success: true,
      message: 'Discovery session and associated emails deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete session',
      message: error.message
    });
  }
};
