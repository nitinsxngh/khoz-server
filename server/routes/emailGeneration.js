const express = require('express');
const router = express.Router();
const emailGenerationService = require('../services/emailGenerationService');
const { protect } = require('../middleware/auth');

// Get all email generation documents for the authenticated user
router.get('/documents', protect, async (req, res) => {
  try {
    const { limit = 20, skip = 0, status } = req.query;
    const userId = req.user.id;
    
    const documents = await emailGenerationService.getUserDocuments(userId, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      status
    });
    
    res.json({
      success: true,
      data: documents,
      pagination: {
        limit: parseInt(limit),
        skip: parseInt(skip),
        total: documents.length
      }
    });
  } catch (error) {
    console.error('Error getting user documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve email generation documents',
      details: error.message
    });
  }
});

// Get a specific email generation document by ID
router.get('/documents/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const document = await emailGenerationService.getDocument(documentId);
    
    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    console.error('Error getting document:', error);
    res.status(404).json({
      success: false,
      error: 'Document not found',
      details: error.message
    });
  }
});

// Get documents by domain
router.get('/domain/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    const { limit = 20, skip = 0 } = req.query;
    
    const documents = await emailGenerationService.getDocumentsByDomain(domain, {
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
    
    res.json({
      success: true,
      data: documents,
      pagination: {
        limit: parseInt(limit),
        skip: parseInt(skip),
        total: documents.length
      }
    });
  } catch (error) {
    console.error('Error getting documents by domain:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve documents by domain',
      details: error.message
    });
  }
});

// Get user statistics
router.get('/statistics', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const stats = await emailGenerationService.getUserStatistics(userId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting user statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user statistics',
      details: error.message
    });
  }
});

// Delete a document (only for authenticated users)
router.delete('/documents/:documentId', protect, async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user.id;
    
    // Get the document to verify ownership
    const document = await emailGenerationService.getDocument(documentId);
    
    if (!document.userId || document.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only delete your own documents.'
      });
    }
    
    // Delete the document
    await document.deleteOne();
    
    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document',
      details: error.message
    });
  }
});

// Export document data (for authenticated users)
router.get('/export/:documentId', protect, async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user.id;
    
    const document = await emailGenerationService.getDocument(documentId);
    
    if (!document.userId || document.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only export your own documents.'
      });
    }
    
    // Format data for export
    const exportData = {
      documentId: document._id,
      createdAt: document.createdAt,
      inputData: document.inputData,
      webhookResponse: document.webhookResponse,
      generatedEmails: document.generatedEmails,
      verificationResults: document.verificationResults,
      statistics: document.statistics,
      processingMetadata: document.processingMetadata
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="email-generation-${documentId}.json"`);
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export document',
      details: error.message
    });
  }
});

// Bulk export multiple documents (for authenticated users)
router.post('/export-bulk', protect, async (req, res) => {
  try {
    const { documentIds } = req.body;
    const userId = req.user.id;
    
    if (!documentIds || !Array.isArray(documentIds)) {
      return res.status(400).json({
        success: false,
        error: 'documentIds array is required'
      });
    }
    
    const documents = [];
    for (const documentId of documentIds) {
      try {
        const document = await emailGenerationService.getDocument(documentId);
        
        if (document.userId && document.userId.toString() === userId) {
          documents.push({
            documentId: document._id,
            createdAt: document.createdAt,
            inputData: document.inputData,
            webhookResponse: document.webhookResponse,
            generatedEmails: document.generatedEmails,
            verificationResults: document.verificationResults,
            statistics: document.statistics,
            processingMetadata: document.processingMetadata
          });
        }
      } catch (error) {
        console.error(`Error getting document ${documentId}:`, error);
      }
    }
    
    if (documents.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No accessible documents found'
      });
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="email-generations-${Date.now()}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      totalDocuments: documents.length,
      documents
    });
  } catch (error) {
    console.error('Error bulk exporting documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk export documents',
      details: error.message
    });
  }
});

module.exports = router;
