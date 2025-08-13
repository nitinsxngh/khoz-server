const express = require('express');
const router = express.Router();

// Import controllers and middleware
const emailDiscoveryController = require('../controllers/emailDiscoveryController');
const { protect } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const emailDiscoveryValidation = require('../middleware/emailDiscoveryValidation');

// Apply authentication middleware to all routes
router.use(protect);

// Discovery Session Management
router.post('/start', 
  emailDiscoveryValidation.validateStartDiscovery,
  handleValidationErrors,
  emailDiscoveryController.startDiscovery
);

router.get('/session/:sessionId/status',
  emailDiscoveryValidation.validateGetSessionStatus,
  handleValidationErrors,
  emailDiscoveryController.getSessionStatus
);

router.post('/session/:sessionId/domain/:domainIndex/process',
  emailDiscoveryValidation.validateProcessDomain,
  handleValidationErrors,
  emailDiscoveryController.processDomain
);

router.get('/session/:sessionId/emails',
  emailDiscoveryValidation.validateGetSessionEmails,
  handleValidationErrors,
  emailDiscoveryController.getSessionEmails
);

// Session Control
router.post('/session/:sessionId/cancel',
  emailDiscoveryValidation.validateCancelSession,
  handleValidationErrors,
  emailDiscoveryController.cancelSession
);

router.delete('/session/:sessionId',
  emailDiscoveryValidation.validateDeleteSession,
  handleValidationErrors,
  emailDiscoveryController.deleteSession
);

// User Statistics and History
router.get('/stats',
  emailDiscoveryController.getUserStats
);

router.get('/history',
  emailDiscoveryValidation.validateGetDiscoveryHistory,
  handleValidationErrors,
  emailDiscoveryController.getDiscoveryHistory
);

// Additional utility routes (can be expanded later)
router.get('/domains', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get unique domains for the user
    const domains = await require('../models/EmailDiscovery').aggregate([
      {
        $match: {
          discoveredBy: require('mongoose').Types.ObjectId(userId),
          isDeleted: false
        }
      },
      {
        $group: {
          _id: '$domain',
          emailCount: { $sum: 1 },
          verifiedCount: {
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
          lastDiscovered: { $max: '$discoveredAt' }
        }
      },
      {
        $sort: { lastDiscovered: -1 }
      }
    ]);
    
    res.json({
      success: true,
      data: domains
    });
    
  } catch (error) {
    console.error('Error getting domains:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get domains',
      message: error.message
    });
  }
});

// Search emails across all sessions
router.get('/search',
  emailDiscoveryValidation.validateSearchEmails,
  handleValidationErrors,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { q, page = 1, limit = 50, sortBy = 'discoveredAt', sortOrder = 'desc' } = req.query;
      
      // Build search query
      const searchQuery = {
        discoveredBy: require('mongoose').Types.ObjectId(userId),
        isDeleted: false,
        $or: [
          { email: { $regex: q, $options: 'i' } },
          { domain: { $regex: q, $options: 'i' } },
          { 'metadata.firstName': { $regex: q, $options: 'i' } },
          { 'metadata.lastName': { $regex: q, $options: 'i' } },
          { 'metadata.nickName': { $regex: q, $options: 'i' } }
        ]
      };
      
      // Build sort object
      const sortObject = {};
      sortObject[sortBy] = sortOrder === 'asc' ? 1 : -1;
      
      // Execute search with pagination
      const skip = (page - 1) * limit;
      const emails = await require('../models/EmailDiscovery').find(searchQuery)
        .sort(sortObject)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('discoverySession', 'sessionType status');
      
      const total = await require('../models/EmailDiscovery').countDocuments(searchQuery);
      
      res.json({
        success: true,
        data: {
          emails,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          },
          query: q
        }
      });
      
    } catch (error) {
      console.error('Error searching emails:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search emails',
        message: error.message
      });
    }
  }
);

// Bulk operations
router.post('/bulk',
  emailDiscoveryValidation.validateBulkOperation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { emailIds, operation } = req.body;
      
      // Verify ownership of all emails
      const emails = await require('../models/EmailDiscovery').find({
        _id: { $in: emailIds },
        discoveredBy: userId,
        isDeleted: false
      });
      
      if (emails.length !== emailIds.length) {
        return res.status(400).json({
          success: false,
          error: 'Some email IDs are invalid or not owned by you'
        });
      }
      
      let result;
      
      switch (operation) {
        case 'delete':
          result = await require('../models/EmailDiscovery').updateMany(
            { _id: { $in: emailIds } },
            { isDeleted: true }
          );
          break;
          
        case 'verify':
          // This would trigger verification process
          result = { message: 'Verification process initiated' };
          break;
          
        case 'export':
          // This would prepare export data
          result = { message: 'Export process initiated' };
          break;
          
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid operation'
          });
      }
      
      res.json({
        success: true,
        message: `Bulk operation '${operation}' completed successfully`,
        data: result
      });
      
    } catch (error) {
      console.error('Error in bulk operation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform bulk operation',
        message: error.message
      });
    }
  }
);

// Export emails
router.post('/export',
  emailDiscoveryValidation.validateExportEmails,
  handleValidationErrors,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { sessionId, format, filters = {} } = req.body;
      
      // Build query
      const query = {
        discoveredBy: require('mongoose').Types.ObjectId(userId),
        isDeleted: false
      };
      
      if (sessionId) {
        query.discoverySession = sessionId;
      }
      
      if (filters.domain) {
        query.domain = filters.domain.toLowerCase();
      }
      
      if (filters.status) {
        query.status = filters.status;
      }
      
      if (filters.confidenceMin || filters.confidenceMax) {
        query.confidence = {};
        if (filters.confidenceMin) query.confidence.$gte = filters.confidenceMin;
        if (filters.confidenceMax) query.confidence.$lte = filters.confidenceMax;
      }
      
      // Get emails for export
      const emails = await require('../models/EmailDiscovery').find(query)
        .sort({ confidence: -1, discoveredAt: -1 })
        .populate('discoverySession', 'sessionType status');
      
      // For now, return JSON format
      // In production, you'd implement actual CSV/XLSX generation
      res.json({
        success: true,
        message: 'Export data prepared successfully',
        data: {
          format,
          totalEmails: emails.length,
          emails: emails.map(email => ({
            email: email.email,
            domain: email.domain,
            confidence: email.confidence,
            status: email.status,
            generationMethod: email.generationMethod,
            discoveredAt: email.discoveredAt,
            verified: email.verification.isVerified,
            deliverable: email.verification.verificationResult?.deliverable || false
          }))
        }
      });
      
    } catch (error) {
      console.error('Error exporting emails:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export emails',
        message: error.message
      });
    }
  }
);

// Health check for email discovery service
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Email Discovery Service is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;
