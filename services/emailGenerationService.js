const EmailGeneration = require('../models/EmailGeneration');
const crypto = require('crypto');

class EmailGenerationService {
  /**
   * Generate emails without creating a session - just return the generated emails
   * @param {Object} data - Input data for email generation
   * @param {string} userId - Optional user ID if authenticated
   * @returns {Promise<Object>} - Generated emails with processing metadata
   */
  async generateEmails(data, userId = null) {
    try {
      const startTime = Date.now();
      
      // Generate emails using the permute function (imported from index.js)
      const { permute } = require('../index.js');
      const emails = permute(data);
      
      const processingTime = Date.now() - startTime;
      
      // Return generated emails without creating a database record
      return {
        emails,
        processingMetadata: {
          status: 'generated',
          totalEmails: emails.length,
          uniqueEmails: new Set(emails.map(e => e.email)).size,
          processingTime,
          domainsProcessed: data.domainsFromFile ? data.domainsFromFile.length + (data.domain ? 1 : 0) : (data.domain ? 1 : 0)
        },
        inputData: {
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          middleName: data.middleName || '',
          nickName: data.nickName || '',
          domain: data.domain,
          useNickName: data.useNickName || false,
          useCustomNames: data.useCustomNames || false,
          usePersonalInfo: data.usePersonalInfo || false,
          useAdvancedEmails: data.useAdvancedEmails || false,
          selectedCustomNames: data.selectedCustomNames || [],
          domainsFromFile: data.domainsFromFile || []
        }
      };
    } catch (error) {
      console.error('Error generating emails:', error);
      throw error;
    }
  }

  /**
   * Create EmailGeneration record after verification is complete
   * @param {Object} data - Complete data including generated emails and verification results
   * @param {string} userId - Optional user ID if authenticated
   * @returns {Promise<Object>} - Created email generation document
   */
  async createAfterVerification(data, userId = null) {
    try {
      // Ensure we have a valid domain
      let domain = data.inputData.domain;
      if (!domain && data.inputData.domainsFromFile && data.inputData.domainsFromFile.length > 0) {
        domain = data.inputData.domainsFromFile[0];
      }
      
      // Format generated emails to include required fields
      const formattedEmails = data.generatedEmails.map(email => {
        let pattern = 'medium';
        let source = 'webhook';

        // Determine pattern based on confidence
        if (email.confidence >= 75) {
          pattern = 'high';
        } else if (email.confidence >= 50) {
          pattern = 'medium';
        } else if (email.confidence >= 25) {
          pattern = 'low';
        } else {
          pattern = 'advanced';
        }

        // Determine source based on email structure
        if (email.source) {
          source = email.source;
        } else if (email.email.includes('@')) {
          // Default to webhook for generated emails
          source = 'webhook';
        }

        return {
          email: email.email,
          confidence: email.confidence,
          pattern,
          source
        };
      });

      const emailGeneration = new EmailGeneration({
        userId,
        inputData: {
          ...data.inputData,
          domain: domain || 'unknown' // Ensure domain is never empty
        },
        generatedEmails: formattedEmails,
        verificationResults: data.verificationResults || [],
        processingMetadata: {
          ...data.processingMetadata,
          status: 'verified',
          totalEmails: formattedEmails.length,
          uniqueEmails: new Set(formattedEmails.map(e => e.email)).size,
          domainsProcessed: data.inputData.domainsFromFile ? data.inputData.domainsFromFile.length : (domain ? 1 : 0)
        },
        statistics: {
          totalVerificationCost: data.verificationResults ? data.verificationResults.reduce((total, result) => total + (result.cost || 0), 0) : 0,
          emailsVerified: data.verificationResults ? data.verificationResults.length : 0,
          deliverableEmails: data.verificationResults ? data.verificationResults.filter(r => r.reachable === 'yes').length : 0,
          undeliverableEmails: data.verificationResults ? data.verificationResults.filter(r => r.reachable === 'no').length : 0
        }
      });

      await emailGeneration.save();
      
      // Return a plain object, not the Mongoose document
      return {
        _id: emailGeneration._id,
        userId: emailGeneration.userId,
        inputData: emailGeneration.inputData,
        generatedEmails: emailGeneration.generatedEmails,
        verificationResults: emailGeneration.verificationResults,
        processingMetadata: emailGeneration.processingMetadata,
        statistics: emailGeneration.statistics,
        createdAt: emailGeneration.createdAt
      };
    } catch (error) {
      console.error('Error creating email generation after verification:', error);
      throw error;
    }
  }

  /**
   * Update webhook response data for an existing record
   * @param {string} documentId - Document ID to update
   * @param {Object} webhookData - Webhook response data
   * @returns {Promise<Object>} - Updated email generation document
   */
  async updateWebhookResponse(documentId, webhookData) {
    try {
      const emailGeneration = await EmailGeneration.findById(documentId);
      if (!emailGeneration) {
        throw new Error('Document not found');
      }

      emailGeneration.webhookResponse = {
        output: webhookData.output,
        domain: webhookData.domain,
        timestamp: webhookData.timestamp,
        note: webhookData.note,
        rawData: webhookData
      };

      await emailGeneration.save();
      return emailGeneration;
    } catch (error) {
      console.error('Error updating webhook response:', error);
      throw error;
    }
  }

  /**
   * Get email generation document by ID
   * @param {string} documentId - Document ID to retrieve
   * @returns {Promise<Object>} - Email generation document
   */
  async getDocument(documentId) {
    try {
      const emailGeneration = await EmailGeneration.findById(documentId);
      if (!emailGeneration) {
        throw new Error('Document not found');
      }
      return emailGeneration;
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  }

  /**
   * Get all documents for a user
   * @param {string} userId - User ID to get documents for
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of email generation documents
   */
  async getUserDocuments(userId, options = {}) {
    try {
      const { limit = 20, skip = 0, status } = options;
      
      let query = { userId };
      if (status) {
        query['processingMetadata.status'] = status;
      }

      const documents = await EmailGeneration.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);

      return documents;
    } catch (error) {
      console.error('Error getting user documents:', error);
      throw error;
    }
  }

  /**
   * Get documents by domain
   * @param {string} domain - Domain to search for
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of email generation documents
   */
  async getDocumentsByDomain(domain, options = {}) {
    try {
      const { limit = 20, skip = 0 } = options;
      
      const documents = await EmailGeneration.findByDomain(domain)
        .limit(limit)
        .skip(skip);

      return documents;
    } catch (error) {
      console.error('Error getting documents by domain:', error);
      throw error;
    }
  }

  /**
   * Update document status
   * @param {string} documentId - Document ID to update
   * @param {string} status - New status
   * @param {string} error - Optional error message
   * @returns {Promise<Object>} - Updated email generation document
   */
  async updateStatus(documentId, status, error = null) {
    try {
      const emailGeneration = await EmailGeneration.findById(documentId);
      if (!emailGeneration) {
        throw new Error('Document not found');
      }

      await emailGeneration.updateStatus(status, error);
      return emailGeneration;
    } catch (error) {
      console.error('Error updating document status:', error);
      throw error;
    }
  }

  /**
   * Delete expired documents
   * @param {Date} expiryDate - Date before which documents should be deleted
   * @returns {Promise<number>} - Number of deleted documents
   */
  async deleteExpiredDocuments(expiryDate) {
    try {
      const result = await EmailGeneration.deleteMany({
        expiresAt: { $lt: expiryDate }
      });
      
      console.log(`Deleted ${result.deletedCount} expired documents`);
      return result.deletedCount;
    } catch (error) {
      console.error('Error deleting expired documents:', error);
      throw error;
    }
  }

  /**
   * Get statistics for a user
   * @param {string} userId - User ID to get statistics for
   * @returns {Promise<Object>} - Statistics object
   */
  async getUserStatistics(userId) {
    try {
      const documents = await EmailGeneration.find({ userId });
      
      const stats = {
        totalDocuments: documents.length,
        totalEmails: 0,
        totalVerified: 0,
        totalDeliverable: 0,
        totalCost: 0,
        averageConfidence: 0,
        domainsProcessed: new Set()
      };

      let totalConfidence = 0;
      let confidenceCount = 0;

      documents.forEach(document => {
        stats.totalEmails += document.generatedEmails ? document.generatedEmails.length : 0;
        stats.totalVerified += document.statistics.emailsVerified || 0;
        stats.totalDeliverable += document.statistics.deliverableEmails || 0;
        stats.totalCost += document.statistics.totalVerificationCost || 0;
        
        if (document.inputData.domain) {
          stats.domainsProcessed.add(document.inputData.domain);
        }

        if (document.generatedEmails) {
          document.generatedEmails.forEach(email => {
            totalConfidence += email.confidence;
            confidenceCount++;
          });
        }
      });

      if (confidenceCount > 0) {
        stats.averageConfidence = Math.round(totalConfidence / confidenceCount);
      }

      stats.uniqueDomains = stats.domainsProcessed.size;
      delete stats.domainsProcessed;

      return stats;
    } catch (error) {
      console.error('Error getting user statistics:', error);
      throw error;
    }
  }
}

module.exports = new EmailGenerationService();
