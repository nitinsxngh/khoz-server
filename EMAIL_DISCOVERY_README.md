# Email Discovery & Verification System

A comprehensive backend system for storing and managing discovered email addresses from both single and multi-domain discovery sessions.

## 🚀 Features

### Core Functionality
- **Email Discovery Storage**: Store discovered emails with metadata and confidence scores
- **Multi-Domain Support**: Handle both single and multi-domain discovery sessions
- **Session Management**: Track discovery sessions with progress and performance metrics
- **Email Verification**: Multiple verification methods (free, premium, manual)
- **Advanced Queries**: Search, filter, and aggregate email data
- **Bulk Operations**: Process multiple emails simultaneously

### Data Models

#### 1. EmailDiscovery Model
Stores individual discovered emails with comprehensive metadata:

```javascript
{
  email: "john.doe@company.com",
  domain: "company.com",
  confidence: 85,
  generationMethod: "personal_info",
  discoveredBy: "user_id",
  discoverySession: "session_id",
  verification: {
    isVerified: false,
    verificationResult: { /* detailed verification data */ }
  },
  metadata: {
    firstName: "John",
    lastName: "Doe",
    nickName: "johnd"
  },
  status: "discovered"
}
```

#### 2. DiscoverySession Model
Tracks discovery sessions and multi-domain processing:

```javascript
{
  userId: "user_id",
  sessionType: "multi_domain",
  domains: [
    { domain: "company1.com", status: "completed", emailsCount: 15 },
    { domain: "company2.com", status: "processing", emailsCount: 0 }
  ],
  formData: { /* discovery configuration */ },
  progress: {
    totalDomains: 2,
    processedDomains: 1,
    totalEmailsDiscovered: 15
  },
  status: "processing"
}
```

## 📁 File Structure

```
server/
├── models/
│   ├── EmailDiscovery.js          # Email discovery data model
│   └── DiscoverySession.js        # Discovery session model
├── controllers/
│   ├── emailDiscoveryController.js # Discovery operations
│   └── emailVerificationController.js # Verification operations
├── middleware/
│   └── emailDiscoveryValidation.js # Input validation
├── routes/
│   ├── emailDiscovery.js          # Discovery API routes
│   └── emailVerification.js       # Verification API routes
├── services/
│   └── emailVerificationService.js # Verification logic
└── test-email-discovery.js        # Comprehensive test suite
```

## 🔌 API Endpoints

### Email Discovery Routes (`/api/email-discovery`)

#### Session Management
- `POST /start` - Start a new discovery session
- `GET /session/:sessionId/status` - Get session status
- `POST /session/:sessionId/domain/:domainIndex/process` - Process a domain
- `GET /session/:sessionId/emails` - Get session emails
- `POST /session/:sessionId/cancel` - Cancel active session
- `DELETE /session/:sessionId` - Delete session and emails

#### Data Retrieval
- `GET /stats` - Get user discovery statistics
- `GET /history` - Get discovery history
- `GET /domains` - Get unique domains with counts
- `GET /search` - Search emails across sessions
- `POST /bulk` - Bulk operations (delete, export)
- `POST /export` - Export email data

### Email Verification Routes (`/api/email-verification`)

#### Verification Operations
- `POST /verify/:emailId` - Verify a single email
- `POST /bulk-verify` - Bulk verify emails
- `GET /status/:emailId` - Get verification status
- `PUT /manual/:emailId` - Update manual verification
- `POST /reverify/:emailId` - Force re-verification

#### Verification Data
- `GET /stats` - Get verification statistics
- `GET /unverified` - Get unverified emails
- `GET /methods` - Get available verification methods

## 🛠️ Usage Examples

### Starting a Discovery Session

```javascript
// Single domain
const session = await fetch('/api/email-discovery/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    domains: ['company.com'],
    formData: {
      firstName: 'John',
      lastName: 'Doe',
      usePersonalInfo: true,
      useAdvancedEmails: true
    },
    config: {
      maxEmailsPerDomain: 100,
      confidenceThreshold: 25
    }
  })
});

// Multi-domain
const multiSession = await fetch('/api/email-discovery/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    domains: ['company1.com', 'company2.com', 'company3.com'],
    formData: { /* same as above */ },
    config: { /* same as above */ }
  })
});
```

### Processing Domains

```javascript
// Process each domain in sequence
for (let i = 0; i < session.totalDomains; i++) {
  await fetch(`/api/email-discovery/session/${sessionId}/domain/${i}/process`, {
    method: 'POST'
  });
}
```

### Verifying Emails

```javascript
// Single email verification
const verification = await fetch(`/api/email-verification/verify/${emailId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'free' // or 'neverbounce', 'manual'
  })
});

// Bulk verification
const bulkVerification = await fetch('/api/email-verification/bulk-verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    emailIds: ['email1_id', 'email2_id', 'email3_id'],
    method: 'free'
  })
});
```

## 🔍 Query Examples

### Find Emails by Domain
```javascript
const emails = await EmailDiscovery.findByDomain('company.com', userId);
```

### Get Verified Emails
```javascript
const verifiedEmails = await EmailDiscovery.findVerified(userId);
```

### Get User Statistics
```javascript
const stats = await EmailDiscovery.getStats(userId);
// Returns: { totalEmails, verifiedEmails, totalDomains, averageConfidence }
```

### Search Emails
```javascript
const searchResults = await fetch('/api/email-discovery/search?q=john&page=1&limit=20');
```

## 📊 Data Aggregation Examples

### Domain Statistics
```javascript
const domainStats = await EmailDiscovery.aggregate([
  {
    $match: { discoveredBy: userId, isDeleted: false }
  },
  {
    $group: {
      _id: '$domain',
      emailCount: { $sum: 1 },
      averageConfidence: { $avg: '$confidence' }
    }
  }
]);
```

### Confidence Distribution
```javascript
const confidenceDistribution = await EmailDiscovery.aggregate([
  {
    $match: { discoveredBy: userId, isDeleted: false }
  },
  {
    $bucket: {
      groupBy: '$confidence',
      boundaries: [0, 25, 50, 75, 100],
      output: { count: { $sum: 1 } }
    }
  }
]);
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
cd server
node test-email-discovery.js
```

The test suite covers:
- Model creation and validation
- Session management
- Email discovery operations
- Verification processes
- Database queries and aggregations
- Error handling

## 🔒 Security Features

- **Authentication Required**: All endpoints require valid JWT tokens
- **User Isolation**: Users can only access their own data
- **Input Validation**: Comprehensive validation for all inputs
- **Rate Limiting**: Applied to prevent abuse
- **Soft Deletes**: Data is marked as deleted rather than permanently removed

## 📈 Performance Features

- **Database Indexes**: Optimized for common query patterns
- **Pagination**: Large result sets are paginated
- **Efficient Aggregations**: MongoDB aggregation pipeline optimization
- **Connection Pooling**: MongoDB connection management
- **Async Operations**: Non-blocking I/O operations

## 🚀 Deployment Considerations

### Environment Variables
```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
NODE_ENV=production
```

### Database Optimization
- Ensure MongoDB indexes are created
- Monitor query performance
- Set appropriate connection pool sizes
- Configure MongoDB for production workloads

### Scaling
- Consider read replicas for heavy query loads
- Implement caching for frequently accessed data
- Monitor API response times
- Set appropriate rate limits

## 🔧 Customization

### Adding New Generation Methods
Extend the `generateEmails` function in `emailDiscoveryController.js`:

```javascript
// Add new email patterns
if (useCustomPattern) {
  emails.push({
    email: `${firstName.toLowerCase()}-${lastName.toLowerCase()}@${domain}`,
    confidence: 75,
    generationMethod: 'custom_pattern'
  });
}
```

### Adding New Verification Providers
Extend the `EmailVerificationService` class:

```javascript
async customVerification(email) {
  // Implement custom verification logic
  return {
    deliverable: true,
    // ... other verification data
  };
}
```

## 📝 API Response Format

All API responses follow a consistent format:

```javascript
{
  success: true/false,
  message: "Human readable message",
  data: { /* response data */ },
  error: "Error details if applicable"
}
```

## 🤝 Contributing

1. Follow the existing code structure
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure all endpoints are properly validated
5. Follow security best practices

## 📄 License

This system is part of the Khozai project and follows the same licensing terms.

---

For questions or support, refer to the main project documentation or create an issue in the project repository.
