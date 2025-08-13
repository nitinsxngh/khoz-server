const { body, param, query } = require('express-validator');

// Validation for starting discovery
exports.validateStartDiscovery = [
  body('domains')
    .isArray({ min: 1 })
    .withMessage('At least one domain is required')
    .custom((domains) => {
      if (!Array.isArray(domains)) {
        throw new Error('Domains must be an array');
      }
      
      for (let i = 0; i < domains.length; i++) {
        const domain = domains[i];
        if (typeof domain !== 'string' || domain.trim().length === 0) {
          throw new Error(`Domain at index ${i} must be a non-empty string`);
        }
        
        // Basic domain validation
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (!domainRegex.test(domain)) {
          throw new Error(`Domain at index ${i} has invalid format: ${domain}`);
        }
      }
      return true;
    }),
  
  body('formData.firstName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  
  body('formData.lastName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  
  body('formData.nickName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('Nickname must be between 1 and 30 characters'),
  
  body('formData.middleName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Middle name must be between 1 and 50 characters'),
  
  body('formData.customName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Custom name must be between 1 and 50 characters'),
  
  body('formData.useNickName')
    .optional()
    .isBoolean()
    .withMessage('useNickName must be a boolean'),
  
  body('formData.useCustomNames')
    .optional()
    .isBoolean()
    .withMessage('useCustomNames must be a boolean'),
  
  body('formData.usePersonalInfo')
    .optional()
    .isBoolean()
    .withMessage('usePersonalInfo must be a boolean'),
  
  body('formData.useAdvancedEmails')
    .optional()
    .isBoolean()
    .withMessage('useAdvancedEmails must be a boolean'),
  
  body('formData.selectedCustomNames')
    .optional()
    .isArray()
    .withMessage('selectedCustomNames must be an array')
    .custom((names) => {
      if (Array.isArray(names)) {
        for (let i = 0; i < names.length; i++) {
          const name = names[i];
          if (typeof name !== 'string' || name.trim().length === 0) {
            throw new Error(`Custom name at index ${i} must be a non-empty string`);
          }
          if (name.length > 50) {
            throw new Error(`Custom name at index ${i} must be 50 characters or less`);
          }
        }
      }
      return true;
    }),
  
  body('config.maxEmailsPerDomain')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('maxEmailsPerDomain must be between 1 and 1000'),
  
  body('config.confidenceThreshold')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('confidenceThreshold must be between 0 and 100'),
  
  body('config.autoVerify')
    .optional()
    .isBoolean()
    .withMessage('autoVerify must be a boolean'),
  
  body('config.verificationLimit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('verificationLimit must be between 1 and 100')
];

// Validation for processing domain
exports.validateProcessDomain = [
  param('sessionId')
    .isMongoId()
    .withMessage('Invalid session ID format'),
  
  param('domainIndex')
    .isInt({ min: 0 })
    .withMessage('Domain index must be a non-negative integer')
];

// Validation for getting session status
exports.validateGetSessionStatus = [
  param('sessionId')
    .isMongoId()
    .withMessage('Invalid session ID format')
];

// Validation for getting session emails
exports.validateGetSessionEmails = [
  param('sessionId')
    .isMongoId()
    .withMessage('Invalid session ID format'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('Limit must be between 1 and 200'),
  
  query('domain')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Domain filter must be between 1 and 100 characters'),
  
  query('status')
    .optional()
    .isIn(['discovered', 'verified', 'invalid', 'error'])
    .withMessage('Status must be one of: discovered, verified, invalid, error'),
  
  query('confidence')
    .optional()
    .matches(/^\d+(-\d+)?$/)
    .withMessage('Confidence must be a number or range (e.g., 50 or 50-75)')
];

// Validation for getting discovery history
exports.validateGetDiscoveryHistory = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('status')
    .optional()
    .isIn(['pending', 'processing', 'completed', 'failed', 'cancelled'])
    .withMessage('Status must be one of: pending, processing, completed, failed, cancelled'),
  
  query('sessionType')
    .optional()
    .isIn(['single_domain', 'multi_domain'])
    .withMessage('Session type must be one of: single_domain, multi_domain')
];

// Validation for cancelling session
exports.validateCancelSession = [
  param('sessionId')
    .isMongoId()
    .withMessage('Invalid session ID format')
];

// Validation for deleting session
exports.validateDeleteSession = [
  param('sessionId')
    .isMongoId()
    .withMessage('Invalid session ID format')
];

// Validation for updating email verification
exports.validateUpdateVerification = [
  param('emailId')
    .isMongoId()
    .withMessage('Invalid email ID format'),
  
  body('verificationResult.deliverable')
    .isBoolean()
    .withMessage('deliverable status is required'),
  
  body('verificationResult.syntax.valid')
    .isBoolean()
    .withMessage('syntax validity is required'),
  
  body('verificationResult.smtp.deliverable')
    .isBoolean()
    .withMessage('SMTP deliverable status is required'),
  
  body('verificationMethod')
    .optional()
    .isIn(['free', 'neverbounce', 'manual'])
    .withMessage('Verification method must be one of: free, neverbounce, manual'),
  
  body('verificationCost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Verification cost must be a non-negative number')
];

// Validation for bulk operations
exports.validateBulkOperation = [
  body('emailIds')
    .isArray({ min: 1 })
    .withMessage('At least one email ID is required')
    .custom((ids) => {
      if (!Array.isArray(ids)) {
        throw new Error('emailIds must be an array');
      }
      
      for (let i = 0; i < ids.length; i++) {
        if (!require('mongoose').Types.ObjectId.isValid(ids[i])) {
          throw new Error(`Invalid email ID at index ${i}: ${ids[i]}`);
        }
      }
      return true;
    }),
  
  body('operation')
    .isIn(['verify', 'delete', 'export'])
    .withMessage('Operation must be one of: verify, delete, export')
];

// Validation for search queries
exports.validateSearchEmails = [
  query('q')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('sortBy')
    .optional()
    .isIn(['email', 'domain', 'confidence', 'discoveredAt', 'status'])
    .withMessage('Sort by must be one of: email, domain, confidence, discoveredAt, status'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be one of: asc, desc')
];

// Validation for export operations
exports.validateExportEmails = [
  body('sessionId')
    .optional()
    .isMongoId()
    .withMessage('Invalid session ID format'),
  
  body('format')
    .isIn(['csv', 'json', 'xlsx'])
    .withMessage('Export format must be one of: csv, json, xlsx'),
  
  body('filters')
    .optional()
    .isObject()
    .withMessage('Filters must be an object'),
  
  body('filters.domain')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Domain filter must be between 1 and 100 characters'),
  
  body('filters.status')
    .optional()
    .isIn(['discovered', 'verified', 'invalid', 'error'])
    .withMessage('Status filter must be one of: discovered, verified, invalid, error'),
  
  body('filters.confidenceMin')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Minimum confidence must be between 0 and 100'),
  
  body('filters.confidenceMax')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Maximum confidence must be between 0 and 100')
];
