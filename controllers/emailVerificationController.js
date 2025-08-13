const emailVerificationService = require('../services/emailVerificationService');
const EmailDiscovery = require('../models/EmailDiscovery');
const { validationResult } = require('express-validator');

// Verify a single email
exports.verifyEmail = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { emailId } = req.params;
    const { method = 'free', customData } = req.body;
    const userId = req.user.id;

    // Get email details
    const email = await EmailDiscovery.findOne({
      _id: emailId,
      discoveredBy: userId,
      isDeleted: false
    });

    if (!email) {
      return res.status(404).json({
        success: false,
        error: 'Email not found or access denied'
      });
    }

    // Check if already verified
    if (email.verification.isVerified) {
      return res.status(400).json({
        success: false,
        error: 'Email is already verified',
        data: {
          email: email.email,
          verification: email.verification
        }
      });
    }

    // Perform verification
    const verificationResult = await emailVerificationService.verifyEmail(
      email.email,
      method,
      customData
    );

    // Update email with verification result
    const updatedEmail = await emailVerificationService.updateEmailVerification(
      emailId,
      verificationResult,
      userId
    );

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        email: updatedEmail.email,
        verification: updatedEmail.verification,
        status: updatedEmail.status
      }
    });

  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify email',
      message: error.message
    });
  }
};

// Bulk verify emails
exports.bulkVerifyEmails = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { emailIds, method = 'free', customData } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Email IDs array is required'
      });
    }

    if (emailIds.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Cannot verify more than 50 emails at once'
      });
    }

    // Get emails and verify ownership
    const emails = await EmailDiscovery.find({
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

    // Filter out already verified emails
    const unverifiedEmails = emails.filter(email => !email.verification.isVerified);
    
    if (unverifiedEmails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'All selected emails are already verified'
      });
    }

    // Perform bulk verification
    const verificationResults = await emailVerificationService.verifyEmails(
      unverifiedEmails.map(e => e.email),
      method,
      unverifiedEmails.length
    );

    // Update emails in database
    const updatePromises = verificationResults.results.map(async (result) => {
      const email = unverifiedEmails.find(e => e.email === result.email);
      if (email) {
        return emailVerificationService.updateEmailVerification(
          email._id,
          result.verification,
          userId
        );
      }
    });

    const updatedEmails = await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'Bulk verification completed',
      data: {
        total: unverifiedEmails.length,
        successful: verificationResults.successful,
        failed: verificationResults.failed,
        results: updatedEmails.filter(Boolean),
        errors: verificationResults.errors
      }
    });

  } catch (error) {
    console.error('Error in bulk verification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk verification',
      message: error.message
    });
  }
};

// Get verification status for an email
exports.getVerificationStatus = async (req, res) => {
  try {
    const { emailId } = req.params;
    const userId = req.user.id;

    const email = await EmailDiscovery.findOne({
      _id: emailId,
      discoveredBy: userId,
      isDeleted: false
    }).select('email domain verification status discoveredAt');

    if (!email) {
      return res.status(404).json({
        success: false,
        error: 'Email not found or access denied'
      });
    }

    res.json({
      success: true,
      data: {
        email: email.email,
        domain: email.domain,
        verification: email.verification,
        status: email.status,
        discoveredAt: email.discoveredAt
      }
    });

  } catch (error) {
    console.error('Error getting verification status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get verification status',
      message: error.message
    });
  }
};

// Get verification statistics
exports.getVerificationStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await emailVerificationService.getVerificationStats(userId);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error getting verification stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get verification statistics',
      message: error.message
    });
  }
};

// Get unverified emails
exports.getUnverifiedEmails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, page = 1 } = req.query;

    const skip = (page - 1) * limit;
    const emails = await EmailDiscovery.find({
      discoveredBy: userId,
      'verification.isVerified': false,
      isDeleted: false
    })
    .sort({ discoveredAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select('email domain confidence discoveredAt generationMethod');

    const total = await EmailDiscovery.countDocuments({
      discoveredBy: userId,
      'verification.isVerified': false,
      isDeleted: false
    });

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
    console.error('Error getting unverified emails:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unverified emails',
      message: error.message
    });
  }
};

// Manual verification update
exports.updateManualVerification = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { emailId } = req.params;
    const { verificationData } = req.body;
    const userId = req.user.id;

    // Validate verification data
    if (!verificationData || typeof verificationData.deliverable !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Valid verification data is required'
      });
    }

    // Update verification
    const updatedEmail = await emailVerificationService.updateEmailVerification(
      emailId,
      verificationData,
      userId
    );

    res.json({
      success: true,
      message: 'Manual verification updated successfully',
      data: {
        email: updatedEmail.email,
        verification: updatedEmail.verification,
        status: updatedEmail.status
      }
    });

  } catch (error) {
    console.error('Error updating manual verification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update manual verification',
      message: error.message
    });
  }
};

// Re-verify email (force re-verification)
exports.reverifyEmail = async (req, res) => {
  try {
    const { emailId } = req.params;
    const { method = 'free', customData } = req.body;
    const userId = req.user.id;

    // Get email details
    const email = await EmailDiscovery.findOne({
      _id: emailId,
      discoveredBy: userId,
      isDeleted: false
    });

    if (!email) {
      return res.status(404).json({
        success: false,
        error: 'Email not found or access denied'
      });
    }

    // Perform verification (even if already verified)
    const verificationResult = await emailVerificationService.verifyEmail(
      email.email,
      method,
      customData
    );

    // Update email with new verification result
    const updatedEmail = await emailVerificationService.updateEmailVerification(
      emailId,
      verificationResult,
      userId
    );

    res.json({
      success: true,
      message: 'Email re-verified successfully',
      data: {
        email: updatedEmail.email,
        verification: updatedEmail.verification,
        status: updatedEmail.status,
        reVerified: true
      }
    });

  } catch (error) {
    console.error('Error re-verifying email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to re-verify email',
      message: error.message
    });
  }
};

// Get verification methods available
exports.getVerificationMethods = async (req, res) => {
  try {
    const methods = [
      {
        id: 'free',
        name: 'Free Verification',
        description: 'Basic email validation and syntax checking',
        cost: 0,
        features: ['Syntax validation', 'Basic domain check', 'No cost'],
        limitations: ['Limited accuracy', 'No SMTP verification']
      },
      {
        id: 'neverbounce',
        name: 'Neverbounce Premium',
        description: 'Professional email verification service',
        cost: 0.01,
        features: ['Full SMTP verification', 'High accuracy', 'Detailed results'],
        limitations: ['Cost per email', 'API rate limits']
      },
      {
        id: 'manual',
        name: 'Manual Verification',
        description: 'User-provided verification data',
        cost: 0,
        features: ['User control', 'No cost', 'Custom data'],
        limitations: ['Requires user input', 'Subjective accuracy']
      }
    ];

    res.json({
      success: true,
      data: methods
    });

  } catch (error) {
    console.error('Error getting verification methods:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get verification methods',
      message: error.message
    });
  }
};
