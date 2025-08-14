const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const { permute } = require('./index.js');
const NeverBounceVerificationService = require('./verificationService.js');

// Import new modules
const connectDB = require('./config/database');
const {
  generalLimiter,
  authLimiter,
  passwordResetLimiter,
  corsOptions,
  securityHeaders,
  requestLogger,
  errorHandler,
  notFound
} = require('./middleware/security');

// Import email generation service
const emailGenerationService = require('./services/emailGenerationService');

// Import fetch for Node.js
const fetch = require('node-fetch');

// Initialize NeverBounce verification service
const verificationService = new NeverBounceVerificationService();

const app = express();
const port = process.env.PORT || 3001;

// Connect to MongoDB
connectDB();

// Security middleware
app.use(securityHeaders);

// CORS configuration
app.use(cors(corsOptions));

// Cookie parser
app.use(cookieParser());

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Rate limiting
app.use(generalLimiter);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Only .txt files are allowed'), false);
    }
  }
});

// Import and use authentication routes
const authRoutes = require('./routes/auth');
const emailGenerationRoutes = require('./routes/emailGeneration');

// Apply rate limiting to auth routes
app.use('/api/auth', authLimiter);
app.use('/api/auth/forgot-password', passwordResetLimiter);
app.use('/api/auth/reset-password', passwordResetLimiter);

// Mount authentication routes
app.use('/api/auth', authRoutes);

// Mount email generation routes
app.use('/api/email-generation', emailGenerationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Perplexity API endpoint
app.post('/api/perplexity', async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    console.log('Perplexity API request for domain:', domain);

    const prompt = `Find the current full names of the Founder, CEO, CTO, and COO of the company that owns the domain ${domain}. 

Requirements:
- Return ONLY a valid JSON object with no additional text
- Use complete full names (first and last name)
- Search thoroughly for ALL executive positions (Founder, CEO, CTO, COO)
- If a position is not found, unknown, or the person has left, use null
- Focus on current leadership (not historical figures)
- Search for the most recent and verified information from the last 3 months
- Pay special attention to finding CTO and COO information
- Use real-time search to find the most up-to-date executive data
- Do not include any markdown formatting, explanations, or additional text
- Ensure the JSON is properly formatted and valid

Expected format:
{
  "Founder": "Full Name or null",
  "CEO": "Full Name or null", 
  "CTO": "Full Name or null",
  "COO": "Full Name or null"
}

Search extensively using real-time web search for the most recent and accurate information about the company's current leadership team. Specifically search:

1. LinkedIn profiles of company executives and founders
2. Company's official website and press releases
3. Recent news articles and announcements
4. Professional networking sites
5. Company blog posts and leadership pages
6. Recent executive announcements and changes
7. Crunchbase, The Org, and other business databases
8. Company's "About Us" and "Team" pages
9. Founder interviews and company history articles
10. Recent funding announcements and company updates

For founders specifically, search for:
- Company founding story and history
- Founder interviews and profiles
- Company registration documents
- Early team members and co-founders
- Recent company announcements about leadership
- "Who founded [company name]" or "[company name] founder"
- Company's founding team and original founders
- Startup incubator or accelerator information
- Company's origin story and founding date
- Search for "[company name] founders" and "[company name] founding team"
- Look for company's first employees and original team members
- Check for any mentions of "co-founder" or "founding team"
- Search specifically for "[company name] founder" or similar variations
- Look for any mentions of the company's original founding team members
- Search for "[company name] founding team" and "[company name] original founders"
- Look for any company history articles or founding stories
- Check for any mentions of the company's first CEO or founding CEO

Look for press releases, company websites, LinkedIn profiles, recent news articles, and executive announcements from the last 3 months to find CTO and COO information. If multiple people hold the same position, list the primary one. Prioritize information from official company sources and recent announcements.`;

    console.log('Sending request to Perplexity API...');

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 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',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.1,
        top_p: 1,
        stream: false
      })
    });

    console.log('Perplexity API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error response:', errorText);
      throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Perplexity API response data:', data);
    
    // Extract the content from the response
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      console.error('No content in Perplexity response:', data);
      throw new Error('No content received from Perplexity API');
    }

    console.log('Perplexity API content:', content);

    // Try to parse the JSON response
    let parsedData;
    try {
      // Remove any markdown formatting if present
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      console.log('Cleaned content:', cleanContent);
      parsedData = JSON.parse(cleanContent);
      console.log('Parsed data:', parsedData);
    } catch (parseError) {
      console.error('Error parsing Perplexity response:', parseError);
      console.error('Raw content that failed to parse:', content);
      // Return the raw content if parsing fails
      parsedData = { 
        raw_response: content,
        error: 'Failed to parse JSON response'
      };
    }

    const result = {
      success: true,
      data: parsedData,
      domain: domain,
      timestamp: new Date().toISOString()
    };

    console.log('Sending result to client:', result);
    res.json(result);

  } catch (error) {
    console.error('Perplexity API error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch company data from Perplexity API',
      details: error.message 
    });
  }
});

// Function to read domains from uploaded file
function readDomainsFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const domains = content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'))
      .map(domain => domain.toLowerCase());
    return domains;
  } catch (error) {
    console.error('Error reading domain file:', error);
    return [];
  }
}

// Existing permute endpoint
app.post('/permute', upload.single('domainFile'), async (req, res) => {
  try {
    console.log('Received form data:', req.body);
    console.log('Received file:', req.file);

    let domainsFromFile = [];
    
    // Process uploaded file if present
    if (req.file) {
      try {
        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        domainsFromFile = fileContent
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#') && line.includes('.'))
          .map(line => line.toLowerCase());
        
        console.log('Domains from uploaded file:', domainsFromFile);
      } catch (fileError) {
        console.error('Error reading file:', fileError);
        return res.status(400).json({ error: 'Error reading uploaded file' });
      }
    }
    
    // Also check for domains sent as form field
    if (req.body.domainsFromFile && typeof req.body.domainsFromFile === 'string') {
      try {
        const formDomains = req.body.domainsFromFile
          .split(',')
          .map(domain => domain.trim())
          .filter(domain => domain && domain.includes('.') && !domain.startsWith('#'))
          .map(domain => domain.toLowerCase());
        
        console.log('Domains from form field:', formDomains);
        
        // Combine domains from file and form field
        domainsFromFile = [...new Set([...domainsFromFile, ...formDomains])];
      } catch (parseError) {
        console.error('Error parsing domains from form field:', parseError);
      }
    }
    
    console.log('Final combined domains:', domainsFromFile);

    // Check if we have multiple domains to process
    const hasMultipleDomains = domainsFromFile.length > 0;
    
    if (hasMultipleDomains) {
      // Process multiple domains
      try {
        const results = await processMultipleDomains(req.body, domainsFromFile, req.file, req.user?.id);
        
        console.log('🔍 Results returned from processMultipleDomains:', {
          type: typeof results,
          keys: Object.keys(results || {}),
          hasGlobalEmails: results && 'globalEmails' in results
        });
        
        // Clean up uploaded file
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        
        res.json(results);
      } catch (error) {
        console.error('❌ Error in processMultipleDomains:', error);
        res.status(500).json({ error: 'Multi-domain processing failed', details: error.message });
      }
    } else {
      // Single domain processing (existing logic)
      const data = {
        firstName: req.body.firstName || '',
        lastName: req.body.lastName || '',
        middleName: req.body.middleName || '',
        nickName: req.body.nickName || '',
        domain: req.body.domain || '',
        useNickName: req.body.useNickName === 'true',
        useCustomNames: req.body.useCustomNames === 'true',
        usePersonalInfo: req.body.usePersonalInfo === 'true',
        useAdvancedEmails: req.body.useAdvancedEmails === 'true',
        selectedCustomNames: req.body.selectedCustomNames ? JSON.parse(req.body.selectedCustomNames) : [],
        domainsFromFile: domainsFromFile,
        webhookResponse: req.body.webhookResponse ? JSON.parse(req.body.webhookResponse) : null
      };

      console.log('Processed data for permute:', data);

      try {
        // If no webhook response exists, automatically get it from Perplexity API
        if (!data.webhookResponse && data.domain) {
          console.log('No webhook response found, automatically calling Perplexity API for domain:', data.domain);
          
          try {
            const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer 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',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'sonar-pro',
                messages: [
                  {
                    role: 'user',
                    content: `Find the current full names of the Founder, CEO, CTO, and COO of the company that owns the domain ${data.domain}. 

Requirements:
- Return ONLY a valid JSON object with no additional text
- Use complete full names (first and last name)
- Search thoroughly for ALL executive positions (Founder, CEO, CTO, COO)
- If a position is not found, unknown, or the person has left, use null
- Focus on current leadership (not historical figures)
- Search for the most recent and verified information from the last 3 months
- Pay special attention to finding CTO and COO information
- Use real-time search to find the most up-to-date executive data
- Do not include any markdown formatting, explanations, or additional text
- Ensure the JSON is properly formatted and valid

Expected format:
{
  "Founder": "Full Name or null",
  "CEO": "Full Name or null", 
  "CTO": "Full Name or null",
  "COO": "Full Name or null"
}`
                  }
                ],
                max_tokens: 500,
                temperature: 0.1,
                top_p: 1,
                stream: false
              })
            });

            if (perplexityResponse.ok) {
              const perplexityData = await perplexityResponse.json();
              const content = perplexityData.choices[0]?.message?.content;
              
              if (content) {
                try {
                  const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
                  const parsedData = JSON.parse(cleanContent);
                  data.webhookResponse = {
                    output: JSON.stringify(parsedData, null, 2),
                    domain: data.domain,
                    timestamp: new Date().toISOString()
                  };
                  console.log('✅ Automatically retrieved webhook response from Perplexity API:', data.webhookResponse);
                } catch (parseError) {
                  console.error('Error parsing Perplexity response:', parseError);
                  // Use fallback data
                  data.webhookResponse = {
                    output: JSON.stringify(generateFallbackData(data.domain), null, 2),
                    domain: data.domain,
                    timestamp: new Date().toISOString(),
                    note: "Using fallback data due to parsing error"
                  };
                }
              }
            }
          } catch (perplexityError) {
            console.error('Perplexity API error for single domain:', perplexityError);
            // Use fallback data
            data.webhookResponse = {
              output: JSON.stringify(generateFallbackData(data.domain), null, 2),
              domain: data.domain,
              timestamp: new Date().toISOString(),
              note: "Using fallback data due to API error"
            };
          }
        }

        // Generate emails without creating a database record
        const result = await emailGenerationService.generateEmails(data, req.user ? req.user.id : null);
        
        console.log('Generated emails:', result.emails);

        // Clean up uploaded file
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        // Return response with generated emails (no session ID)
        res.json({
          success: true,
          emails: result.emails,
          processingMetadata: result.processingMetadata,
          inputData: result.inputData,
          message: 'Emails generated successfully. Use /api/smart-verify to verify and save them.'
        });
      } catch (error) {
        console.error('Error generating emails:', error);
        res.status(500).json({ error: 'Email generation failed', details: error.message });
      }
    }

  } catch (error) {
    console.error('Error in permute endpoint:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// New function to process multiple domains
async function processMultipleDomains(formData, domainsFromFile, uploadedFile, userId = null) {
  const allDomains = [];
  
  // Add single domain if provided
  if (formData.domain && formData.domain.trim()) {
    allDomains.push(formData.domain.trim().toLowerCase());
  }
  
  // Add domains from file
  allDomains.push(...domainsFromFile);
  
  // Remove duplicates and filter valid domains, clean URLs to just domains
  const uniqueDomains = [...new Set(allDomains)]
    .filter(domain => domain && domain.includes('.') && !domain.startsWith('#'))
    .map(domain => {
      // Extract just the domain from URLs
      if (domain.includes('://')) {
        try {
          const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
          return url.hostname.replace(/^www\./, '');
        } catch {
          // If URL parsing fails, try to extract manually
          const match = domain.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/);
          return match ? match[1].replace(/^www\./, '') : domain.replace(/^www\./, '');
        }
      }
      return domain.replace(/^www\./, '');
    });
  
  console.log(`Processing ${uniqueDomains.length} unique domains:`, uniqueDomains);
  
  const results = [];
  const allCombinedEmails = []; // Array to hold all emails from all domains
  
  for (let i = 0; i < uniqueDomains.length; i++) {
    const domain = uniqueDomains[i];
    console.log(`\n--- Processing domain ${i + 1}/${uniqueDomains.length}: ${domain} ---`);
    
    try {
      // Get Perplexity AI data for this domain
      let webhookResponse = null;
      try {
        const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer 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',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sonar-pro',
            messages: [
              {
                role: 'user',
                content: `Find the current full names of the Founder, CEO, CTO, and COO of the company that owns the domain ${domain}. 

Requirements:
- Return ONLY a valid JSON object with no additional text
- Use complete full names (first and last name)
- Search thoroughly for ALL executive positions (Founder, CEO, CTO, COO)
- If a position is not found, unknown, or the person has left, use null
- Focus on current leadership (not historical figures)
- Search for the most recent and verified information from the last 3 months
- Pay special attention to finding CTO and COO information
- Use real-time search to find the most up-to-date executive data
- Do not include any markdown formatting, explanations, or additional text
- Ensure the JSON is properly formatted and valid

Expected format:
{
  "Founder": "Full Name or null",
  "CEO": "Full Name or null", 
  "CTO": "Full Name or null",
  "COO": "Full Name or null"
}`
              }
            ],
            max_tokens: 500,
            temperature: 0.1,
            top_p: 1,
            stream: false
          })
        });

        if (perplexityResponse.ok) {
          const data = await perplexityResponse.json();
          const content = data.choices[0]?.message?.content;
          
          if (content) {
            try {
              const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
              const parsedData = JSON.parse(cleanContent);
              webhookResponse = {
                output: JSON.stringify(parsedData, null, 2),
                domain: domain,
                timestamp: new Date().toISOString()
              };
            } catch (parseError) {
              console.error(`Error parsing Perplexity response for ${domain}:`, parseError);
              // Use fallback data
              webhookResponse = {
                output: JSON.stringify(generateFallbackData(domain), null, 2),
                domain: domain,
                timestamp: new Date().toISOString(),
                note: "Using fallback data due to parsing error"
              };
            }
          }
        }
      } catch (perplexityError) {
        console.error(`Perplexity API error for ${domain}:`, perplexityError);
        // Use fallback data
        webhookResponse = {
          output: JSON.stringify(generateFallbackData(domain), null, 2),
          domain: domain,
          timestamp: new Date().toISOString(),
          note: "Using fallback data due to API error"
        };
      }
      
      // Generate emails for this domain
      const data = {
        firstName: formData.firstName || '',
        lastName: formData.lastName || '',
        middleName: formData.middleName || '',
        nickName: formData.nickName || '',
        domain: domain,
        useNickName: formData.useNickName === 'true',
        useCustomNames: formData.useCustomNames === 'true',
        usePersonalInfo: formData.usePersonalInfo === 'true',
        useAdvancedEmails: formData.useAdvancedEmails === 'true',
        selectedCustomNames: formData.selectedCustomNames ? JSON.parse(formData.selectedCustomNames) : [],
        domainsFromFile: [],
        webhookResponse: webhookResponse
      };
      
      const emails = permute(data);
      
      results.push({
        domain: domain,
        emails: emails,
        webhookResponse: webhookResponse,
        status: 'completed',
        timestamp: new Date().toISOString()
      });
      
      // Add all emails to a combined array for global sorting
      if (emails && emails.length > 0) {
        allCombinedEmails.push(...emails);
      }
      
      console.log(`✅ Completed domain ${domain}: ${emails.length} emails generated`);
      
      // Add delay between domains to be respectful to APIs
      if (i < uniqueDomains.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`❌ Error processing domain ${domain}:`, error);
      results.push({
        domain: domain,
        emails: [],
        webhookResponse: null,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  console.log(`\n🎉 Multi-domain processing completed. Processed ${results.length} domains.`);
  
  // Sort all combined emails by confidence (highest first) and remove duplicates
  const uniqueCombinedEmails = [];
  const seenEmails = new Set();
  
  allCombinedEmails
    .sort((a, b) => b.confidence - a.confidence)
    .forEach(email => {
      if (!seenEmails.has(email.email)) {
        seenEmails.add(email.email);
        uniqueCombinedEmails.push(email);
      }
    });
  
  console.log(`Total unique emails across all domains: ${uniqueCombinedEmails.length}`);
  
  // Return the results without creating a database record
  const responseData = {
    domainResults: results,
    globalEmails: uniqueCombinedEmails,
    message: 'Multi-domain processing completed. Use /api/smart-verify to verify and save the emails.'
  };
  
  console.log('🔍 Multi-domain response data being sent to client:', {
    hasGlobalEmails: !!responseData.globalEmails,
    globalEmailsCount: responseData.globalEmails?.length || 0,
    hasDomainResults: !!responseData.domainResults,
    domainResultsCount: responseData.domainResults?.length || 0,
    message: responseData.message,
    responseKeys: Object.keys(responseData)
  });
  
  return responseData;
}

// Fallback data generator for when Perplexity API fails
function generateFallbackData(domain) {
  return {
    Founder: null,
    CEO: null,
    CTO: null,
    COO: null,
    note: `Fallback data generated for ${domain} due to API limitations`
  };
}

// NeverBounce verification endpoint
app.post('/api/smart-verify', async (req, res) => {
  try {
    console.log('\n🔍 Smart-verify request received:');
    console.log('📋 Full request body:', JSON.stringify(req.body, null, 2));
    console.log('📋 Request headers:', req.headers);
    
    const { emailsWithConfidence, maxEmails = 10, inputData, userId, allGeneratedEmails } = req.body;
    
    console.log(`\n🔍 Smart-verify request received:`, {
      emailsCount: emailsWithConfidence?.length || 0,
      maxEmails,
      hasInputData: !!inputData,
      hasAllGeneratedEmails: !!allGeneratedEmails,
      allGeneratedEmailsCount: allGeneratedEmails?.length || 0,
      userId: userId || 'NOT PROVIDED',
      hasEmailsWithConfidence: !!emailsWithConfidence,
      isArray: Array.isArray(emailsWithConfidence),
      bodyKeys: Object.keys(req.body || {})
    });
    
    if (!emailsWithConfidence || !Array.isArray(emailsWithConfidence)) {
      return res.status(400).json({ error: 'emailsWithConfidence array is required' });
    }

    console.log(`\n🚀 NeverBounce verification request for ${emailsWithConfidence.length} emails, max: ${maxEmails}`);

    // Reset session for new verification batch
    verificationService.resetSession();

    // Perform NeverBounce verification
    const results = await verificationService.batchVerification(emailsWithConfidence, maxEmails);
    
    // Get usage statistics
    const usageStats = verificationService.getUsageStats();

    // Create EmailGeneration record after verification is complete
    let createdDocument = null;
    if (inputData) {
      try {
        console.log(`🔍 Creating EmailGeneration record after verification completion`);
        
        // Ensure we have a valid domain for the inputData
        let effectiveDomain = inputData.domain;
        if (!effectiveDomain && inputData.domainsFromFile && inputData.domainsFromFile.length > 0) {
          effectiveDomain = inputData.domainsFromFile[0];
        }
        
        // Use allGeneratedEmails if provided, otherwise fall back to emails being verified
        const allGeneratedEmailsToStore = allGeneratedEmails || emailsWithConfidence;
        
        console.log(`📊 Processing ${allGeneratedEmailsToStore.length} total generated emails and ${results.length} verification results`);
        
        // Prepare data for the service
        const documentData = {
          inputData: {
            ...inputData,
            domain: effectiveDomain || 'unknown'
          },
          generatedEmails: allGeneratedEmailsToStore,
          verificationResults: results,
          processingMetadata: {
            status: 'verified',
            totalEmails: allGeneratedEmailsToStore.length,
            uniqueEmails: new Set(allGeneratedEmailsToStore.map(e => e.email)).size,
            domainsProcessed: inputData.domainsFromFile ? inputData.domainsFromFile.length : (effectiveDomain ? 1 : 0)
          }
        };
        
        createdDocument = await emailGenerationService.createAfterVerification(documentData, userId);
        console.log(`✅ EmailGeneration record created successfully with ID: ${createdDocument._id}`);
        console.log(`📊 Stored ${allGeneratedEmailsToStore.length} generated emails and ${results.length} verification results`);
      } catch (dbError) {
        console.error('❌ Error creating EmailGeneration record:', dbError);
        // Don't fail the request if database save fails
      }
    } else {
      console.log('⚠️ No inputData provided, skipping database record creation');
    }

    res.json({
      results,
      usageStats,
      message: `Verified ${results.length} emails using NeverBounce API`,
      documentId: createdDocument ? createdDocument._id : null,
      createdDocument: createdDocument
    });

  } catch (error) {
    console.error('Error in NeverBounce verification endpoint:', error);
    res.status(500).json({ 
      error: 'NeverBounce verification failed', 
      details: error.message 
    });
  }
});

// Get verification usage statistics
app.get('/api/verification-stats', (req, res) => {
  try {
    const stats = verificationService.getUsageStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting verification stats:', error);
    res.status(500).json({ error: 'Failed to get verification stats' });
  }
});

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${port}/api/health`);
});
