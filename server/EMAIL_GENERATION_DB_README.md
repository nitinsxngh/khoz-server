# Email Generation Database Documentation

This document describes the new database functionality for storing and managing email generation sessions and results in a structured format.

## Overview

The email generation system now automatically saves all generated email data to MongoDB, including:
- Input parameters used for generation
- Webhook/Perplexity AI responses
- Generated emails with confidence scores
- Email verification results
- Processing metadata and statistics

## Database Schema

### EmailGeneration Model

The main model stores complete email generation sessions with the following structure:

```javascript
{
  userId: ObjectId,           // Optional: User ID if authenticated
  sessionId: String,          // Unique session identifier
  inputData: {                // Input parameters used
    firstName: String,
    lastName: String,
    middleName: String,
    nickName: String,
    domain: String,
    useNickName: Boolean,
    useCustomNames: Boolean,
    usePersonalInfo: Boolean,
    useAdvancedEmails: Boolean,
    selectedCustomNames: [String],
    domainsFromFile: [String]
  },
  webhookResponse: {           // Perplexity AI response data
    output: String,
    domain: String,
    timestamp: Date,
    note: String,
    rawData: Mixed
  },
  generatedEmails: [{          // Generated emails with metadata
    email: String,
    confidence: Number,
    pattern: String,           // 'high', 'medium', 'low', 'advanced', 'custom'
    source: String            // 'webhook', 'custom_names', 'personal_info'
  }],
  processingMetadata: {        // Processing information
    totalEmails: Number,
    uniqueEmails: Number,
    processingTime: Number,
    domainsProcessed: Number,
    status: String,           // 'pending', 'processing', 'completed', 'error'
    error: String
  },
  verificationResults: [{      // Email verification results
    email: String,
    reachable: String,        // 'unknown', 'yes', 'no'
    syntax: Object,
    smtp: Object,
    verificationMethod: String,
    cost: Number
  }],
  statistics: {                // Aggregated statistics
    totalVerificationCost: Number,
    emailsVerified: Number,
    deliverableEmails: Number,
    undeliverableEmails: Number
  },
  createdAt: Date,
  updatedAt: Date,
  expiresAt: Date             // Optional: for data retention policies
}
```

## API Endpoints

### Email Generation Routes

All routes are prefixed with `/api/email-generation`

#### GET `/sessions`
Get all email generation sessions for the authenticated user.

**Query Parameters:**
- `limit` (optional): Number of sessions to return (default: 20)
- `skip` (optional): Number of sessions to skip (default: 0)
- `status` (optional): Filter by status ('pending', 'processing', 'completed', 'error')

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "limit": 20,
    "skip": 0,
    "total": 5
  }
}
```

#### GET `/sessions/:sessionId`
Get a specific email generation session by session ID.

**Response:**
```json
{
  "success": true,
  "data": {
    // Complete session object
  }
}
```

#### GET `/domain/:domain`
Get all sessions for a specific domain.

**Query Parameters:**
- `limit` (optional): Number of sessions to return (default: 20)
- `skip` (optional): Number of sessions to skip (default: 0)

#### GET `/statistics`
Get aggregated statistics for the authenticated user.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSessions": 10,
    "totalEmails": 150,
    "totalVerified": 100,
    "totalDeliverable": 75,
    "totalCost": 2.50,
    "averageConfidence": 78,
    "uniqueDomains": 5
  }
}
```

#### DELETE `/sessions/:sessionId`
Delete a session (only for authenticated users who own the session).

#### GET `/export/:sessionId`
Export a session as JSON file (only for authenticated users who own the session).

#### POST `/export-bulk`
Export multiple sessions as JSON file.

**Body:**
```json
{
  "sessionIds": ["session1", "session2", "session3"]
}
```

## Integration with Existing Endpoints

### Permute Endpoint

The existing `/permute` endpoint now automatically saves data:

**Single Domain:**
```json
{
  "success": true,
  "sessionId": "uuid-here",
  "emails": [...],
  "message": "Emails generated and saved successfully"
}
```

**Multiple Domains:**
```json
{
  "sessionId": "uuid-here",
  "domainResults": [...],
  "globalEmails": [...],
  "message": "Multi-domain processing completed and saved successfully"
}
```

### Email Verification Endpoint

The `/api/smart-verify` endpoint now accepts a `sessionId` parameter to save verification results:

**Request:**
```json
{
  "emailsWithConfidence": [...],
  "maxEmails": 10,
  "sessionId": "uuid-here"
}
```

**Response:**
```json
{
  "results": [...],
  "usageStats": {...},
  "message": "Verified 10 emails using NeverBounce API",
  "sessionId": "uuid-here"
}
```

## Usage Examples

### Creating and Saving Email Generation Data

```javascript
// The system automatically creates sessions when calling /permute
const response = await fetch('/permute', {
  method: 'POST',
  body: formData
});

const { sessionId, emails } = await response.json();

// Use sessionId for verification
const verifyResponse = await fetch('/api/smart-verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    emailsWithConfidence: emails,
    maxEmails: 10,
    sessionId: sessionId
  })
});
```

### Retrieving Session Data

```javascript
// Get session details
const sessionResponse = await fetch(`/api/email-generation/sessions/${sessionId}`);
const session = await sessionResponse.json();

// Get user's sessions
const userSessionsResponse = await fetch('/api/email-generation/sessions');
const userSessions = await userSessionsResponse.json();

// Get statistics
const statsResponse = await fetch('/api/email-generation/statistics');
const stats = await statsResponse.json();
```

### Exporting Data

```javascript
// Export single session
const exportResponse = await fetch(`/api/email-generation/export/${sessionId}`);
const exportData = await exportResponse.json();

// Bulk export
const bulkExportResponse = await fetch('/api/email-generation/export-bulk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionIds: ['session1', 'session2']
  })
});
```

## Testing

Run the test script to verify database functionality:

```bash
cd server
node test-email-generation.js
```

This will:
1. Connect to the database
2. Create a test session
3. Update webhook response data
4. Save generated emails
5. Save verification results
6. Retrieve and display session data
7. Close the database connection

## Benefits

1. **Data Persistence**: All email generation data is automatically saved
2. **Session Management**: Track multiple generation sessions per user
3. **Analytics**: Built-in statistics and reporting capabilities
4. **Data Export**: Easy export of session data for analysis
5. **Audit Trail**: Complete history of email generation activities
6. **Cost Tracking**: Monitor verification costs across sessions
7. **Performance Metrics**: Track processing times and success rates

## Security Features

- User authentication required for sensitive operations
- Session ownership verification for deletions and exports
- Rate limiting on all endpoints
- Input validation and sanitization
- Secure database connections with proper indexing

## Database Indexes

The following indexes are created for optimal performance:

- `userId + createdAt` (descending)
- `domain + createdAt` (descending)
- `processingMetadata.status`
- `sessionId` (unique)
- `createdAt` (descending)
- `expiresAt` (for data retention)

## Data Retention

Sessions can optionally include an `expiresAt` field for automatic cleanup. Use the `deleteExpiredSessions()` method to remove old data:

```javascript
const expiryDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
await emailGenerationService.deleteExpiredSessions(expiryDate);
```
