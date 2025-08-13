const express = require('express');
const router = express.Router();

// Import controllers and middleware
const emailVerificationController = require('../controllers/emailVerificationController');
const { protect } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const emailDiscoveryValidation = require('../middleware/emailDiscoveryValidation');

// Apply authentication middleware to all routes
router.use(protect);

// Single email verification
router.post('/verify/:emailId',
  emailDiscoveryValidation.validateUpdateVerification,
  handleValidationErrors,
  emailVerificationController.verifyEmail
);

// Bulk email verification
router.post('/bulk-verify',
  emailDiscoveryValidation.validateBulkOperation,
  handleValidationErrors,
  emailVerificationController.bulkVerifyEmails
);

// Get verification status
router.get('/status/:emailId',
  emailVerificationController.getVerificationStatus
);

// Get verification statistics
router.get('/stats',
  emailVerificationController.getVerificationStats
);

// Get unverified emails
router.get('/unverified',
  emailVerificationController.getUnverifiedEmails
);

// Manual verification update
router.put('/manual/:emailId',
  emailDiscoveryValidation.validateUpdateVerification,
  handleValidationErrors,
  emailVerificationController.updateManualVerification
);

// Re-verify email
router.post('/reverify/:emailId',
  emailDiscoveryValidation.validateUpdateVerification,
  handleValidationErrors,
  emailVerificationController.reverifyEmail
);

// Get available verification methods
router.get('/methods',
  emailVerificationController.getVerificationMethods
);

// Health check for verification service
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Email Verification Service is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;
