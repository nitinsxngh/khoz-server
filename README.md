# Khozai Backend Server

A secure and robust backend server for the Khozai application with comprehensive authentication, user management, and email services.

## 🚀 Features

### Authentication & Security
- **JWT-based authentication** with secure token management
- **Password hashing** using bcrypt with salt rounds of 12
- **Rate limiting** to prevent brute force attacks
- **Account locking** after 5 failed login attempts
- **CORS protection** with configurable origins
- **Security headers** using Helmet.js
- **Input validation** with express-validator
- **Cookie-based tokens** with httpOnly and secure flags

### User Management
- **User registration** with email validation
- **Secure login** with account protection
- **Profile management** with preferences
- **Password reset** functionality
- **Email verification** system (ready for implementation)
- **Role-based access control** (user/admin)

### Database
- **MongoDB integration** with Mongoose ODM
- **Optimized schemas** with proper indexing
- **Data validation** at the model level
- **Connection management** with error handling

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB database
- npm or yarn package manager

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `config.env` file in the server root:
   ```env
   # MongoDB Connection
   MONGO_URI=mongodb+srv://gomaterial:gomaterial%40123@admin-gomaterial.r3p4ezm.mongodb.net/khoz?retryWrites=true&w=majority&appName=Admin-Gomaterial
   
   # JWT Secret (generate a strong secret in production)
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   
   # JWT Expiration
   JWT_EXPIRES_IN=7d
   
   # Server Configuration
   PORT=3001
   NODE_ENV=development
   
   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   
   # CORS Origins
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002,http://127.0.0.1:3002
   ```

4. **Start the server**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

## 🔐 Authentication Endpoints

### Public Routes

#### POST `/api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!",
  "phone": "+1234567890",
  "agreeToTerms": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": { ... },
    "token": "jwt_token_here"
  }
}
```

#### POST `/api/auth/login`
Authenticate user and receive access token.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "token": "jwt_token_here"
  }
}
```

#### POST `/api/auth/forgot-password`
Request password reset link.

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

#### POST `/api/auth/reset-password`
Reset password using reset token.

**Request Body:**
```json
{
  "token": "reset_token_here",
  "password": "NewSecurePass123!",
  "confirmPassword": "NewSecurePass123!"
}
```

### Protected Routes (Require Authentication)

#### GET `/api/auth/me`
Get current user profile.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

#### PUT `/api/auth/profile`
Update user profile.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+1234567890",
  "preferences": {
    "theme": "dark",
    "notifications": {
      "email": true,
      "push": false
    }
  }
}
```

#### PUT `/api/auth/change-password`
Change user password.

**Request Body:**
```json
{
  "currentPassword": "OldSecurePass123!",
  "newPassword": "NewSecurePass123!",
  "confirmPassword": "NewSecurePass123!"
}
```

#### POST `/api/auth/logout`
Logout user and invalidate token.

#### POST `/api/auth/refresh`
Refresh JWT token.

## 🛡️ Security Features

### Rate Limiting
- **General requests**: 100 requests per 15 minutes
- **Authentication**: 5 attempts per 15 minutes
- **Password reset**: 3 attempts per hour

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Account Protection
- Account locked after 5 failed login attempts
- Lock duration: 2 hours
- Automatic unlock after lock period expires

### Token Security
- JWT tokens with configurable expiration
- HttpOnly cookies for enhanced security
- Secure flag in production environment
- SameSite strict policy

## 🗄️ Database Schema

### User Model
```javascript
{
  firstName: String (required, max 50 chars),
  lastName: String (required, max 50 chars),
  email: String (required, unique, validated),
  password: String (required, hashed, min 8 chars),
  phone: String (optional, validated),
  isEmailVerified: Boolean (default: false),
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  lastLogin: Date,
  loginAttempts: Number (default: 0),
  lockUntil: Date,
  isActive: Boolean (default: true),
  role: String (enum: ['user', 'admin'], default: 'user'),
  preferences: {
    theme: String (enum: ['light', 'dark', 'auto']),
    notifications: {
      email: Boolean,
      push: Boolean
    }
  },
  timestamps: true
}
```

## 🔧 Configuration

### Environment Variables
- `MONGO_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT signing
- `JWT_EXPIRES_IN`: JWT token expiration time
- `PORT`: Server port number
- `NODE_ENV`: Environment (development/production)
- `RATE_LIMIT_WINDOW_MS`: Rate limiting window in milliseconds
- `RATE_LIMIT_MAX_REQUESTS`: Maximum requests per window
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins

### CORS Configuration
- Configurable allowed origins
- Credentials support enabled
- Secure headers and methods

## 📊 Health Check

### GET `/api/health`
Check server status and uptime.

**Response:**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456
}
```

## 🚨 Error Handling

The server includes comprehensive error handling for:
- Validation errors
- Authentication failures
- Database errors
- Rate limiting violations
- CORS violations
- JWT token errors

All errors return consistent JSON responses with appropriate HTTP status codes.

## 🔒 Production Considerations

1. **Change JWT_SECRET** to a strong, unique value
2. **Set NODE_ENV=production**
3. **Configure secure CORS origins**
4. **Use HTTPS in production**
5. **Implement email service** for verification and password reset
6. **Set up monitoring and logging**
7. **Configure MongoDB connection pooling**
8. **Implement backup strategies**

## 📝 API Documentation

For detailed API documentation, refer to the individual route files and controllers. Each endpoint includes:
- Request/response examples
- Validation requirements
- Authentication requirements
- Error handling

## 🤝 Contributing

1. Follow the existing code structure
2. Add proper validation and error handling
3. Include comprehensive tests
4. Update documentation
5. Follow security best practices

## 📄 License

This project is licensed under the MIT License.
