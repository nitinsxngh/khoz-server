const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const {
  validateRegistration,
  validateLogin,
  validatePasswordResetRequest,
  validatePasswordReset,
  validateProfileUpdate,
  validatePasswordChange
} = require('../middleware/validation');

// Public routes
router.post('/register', validateRegistration, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/forgot-password', validatePasswordResetRequest, authController.forgotPassword);
router.post('/reset-password', validatePasswordReset, authController.resetPassword);

// Protected routes
router.use(protect); // All routes below this middleware require authentication
router.post('/logout', authController.logout);
router.get('/me', authController.getMe);
router.put('/profile', validateProfileUpdate, authController.updateProfile);
router.put('/change-password', validatePasswordChange, authController.changePassword);
router.post('/refresh', authController.refreshToken);

module.exports = router;
