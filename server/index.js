// Email permutation logic with confidence-based ranking
// This replaces the old email generation system with a more intelligent ranking approach

function permute(data) {
  const { firstName, lastName, middleName, nickName, domain, useNickName, useCustomNames, selectedCustomNames, domainsFromFile, webhookResponse, useAdvancedEmails } = data;
  
  // Clean the domain to remove protocol, www, and trailing slashes
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  
  let webhookNames = [];

  // Process webhook response if available
  if (!data.usePersonalInfo && webhookResponse) {
    try {
      const outputText = webhookResponse.output;
      console.log('Processing webhook output:', outputText);
      try {
        const parsedJson = JSON.parse(outputText);
        console.log('Successfully parsed JSON:', parsedJson);
        webhookNames = Object.values(parsedJson)
          .filter(name => name !== null && name !== 'null' && name.toString().trim() !== '')
          .map(name => name.toString());
        console.log('Parsed webhook names after filtering:', webhookNames);
        console.log('Extracted webhook names:', webhookNames);
      } catch (e) {
        console.error('Error parsing clean JSON:', e);
        const jsonMatch = outputText.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          try {
            const parsedJson = JSON.parse(jsonMatch[1]);
            webhookNames = Object.values(parsedJson)
              .filter(name => name !== null && name !== 'null' && name.toString().trim() !== '')
              .map(name => name.toString());
            console.log('Parsed webhook names from markdown after filtering:', webhookNames);
          } catch (parseError) {
            console.error('Error parsing webhook JSON from markdown:', parseError);
          }
        } else {
          console.error('Could not parse webhook output:', outputText);
        }
      }
    } catch (error) {
      console.error('Error processing webhook response:', error);
    }
  }

  // Generate emails with confidence ranking
  const generateRankedEmails = (names) => {
    const allEmailPatterns = [];
    
    names.forEach(fullName => {
      const nameParts = fullName.trim().split(/\s+/);
      if (nameParts.length === 0) return;
      
      const firstName = nameParts[0].toLowerCase();
      const lastName = nameParts[nameParts.length - 1].toLowerCase();
      const firstInitial = firstName.charAt(0);
      const lastInitial = lastName.charAt(0);
      
      console.log(`Processing name: ${fullName} -> firstName: ${firstName}, lastName: ${lastName}`);
      
      const personEmails = [];
      
      // High Confidence Patterns (Most Common) - 95-75% confidence
      const highConfidence = [
        { email: `${firstName}.${lastName}@${cleanDomain}`, confidence: 95 },
        { email: `${firstName}@${cleanDomain}`, confidence: 90 },
        { email: `${firstName}${lastName}@${cleanDomain}`, confidence: 85 },
        { email: `${firstInitial}${lastName}@${cleanDomain}`, confidence: 80 },
        { email: `${lastName}@${cleanDomain}`, confidence: 75 }
      ];
      
      // Medium Confidence Patterns - 70-50% confidence
      const mediumConfidence = [
        { email: `${firstName}-${lastName}@${domain}`, confidence: 70 },
        { email: `${firstName}_${lastName}@${domain}`, confidence: 65 },
        { email: `${firstInitial}.${lastName}@${domain}`, confidence: 60 },
        { email: `${firstInitial}${lastInitial}@${domain}`, confidence: 55 },
        { email: `${firstName}${firstInitial}@${domain}`, confidence: 50 }
      ];
      
      // Lower Confidence Patterns - 45-25% confidence
      const lowerConfidence = [
        { email: `${firstInitial}-${lastName}@${domain}`, confidence: 45 },
        { email: `${firstInitial}_${lastName}@${domain}`, confidence: 40 },
        { email: `${firstName}${lastInitial}@${domain}`, confidence: 35 },
        { email: `${lastName}${firstInitial}@${domain}`, confidence: 30 },
        { email: `${firstInitial}.${firstInitial}@${domain}`, confidence: 25 }
      ];
      
      // Advanced Patterns (if enabled) - 20-5% confidence
      if (useAdvancedEmails) {
        const advancedPatterns = [
          { email: `${firstName}${lastName}${firstInitial}@${domain}`, confidence: 20 },
          { email: `${lastName}${firstName}@${domain}`, confidence: 15 },
          { email: `${firstInitial}${lastName}${lastInitial}@${domain}`, confidence: 10 },
          { email: `${firstName}${lastName}${Math.floor(Math.random() * 100)}@${domain}`, confidence: 5 }
        ];
        personEmails.push(...advancedPatterns);
      }
      
      personEmails.push(...highConfidence, ...mediumConfidence, ...lowerConfidence);
      console.log(`High confidence emails for ${fullName}:`, highConfidence.map(e => e.email));
      allEmailPatterns.push(...personEmails);
    });
    
    // Sort by confidence (highest first) and remove duplicates
    const uniqueEmailsWithConfidence = [];
    const seenEmails = new Set();
    
    allEmailPatterns
      .sort((a, b) => b.confidence - a.confidence)
      .forEach(pattern => {
        if (!seenEmails.has(pattern.email)) {
          seenEmails.add(pattern.email);
          uniqueEmailsWithConfidence.push({
            email: pattern.email,
            confidence: pattern.confidence
          });
        }
      });
    
    return uniqueEmailsWithConfidence;
  };

  let allEmails = [];

  // Generate emails for webhook names
  if (webhookNames.length > 0) {
    console.log('Processing webhook names:', webhookNames);
    const webhookEmails = generateRankedEmails(webhookNames);
    console.log('Generated emails from webhook:', webhookEmails);
    allEmails.push(...webhookEmails);
  }

  // Personal info is no longer used since manual mode is removed
  // All emails come from webhook (Perplexity AI) and custom names

  // Generate emails for custom names if enabled
  if (useCustomNames && selectedCustomNames.length > 0) {
    console.log('Processing custom names:', selectedCustomNames);
    const customEmails = selectedCustomNames.map(name => ({
      email: `${name}@${cleanDomain}`,
      confidence: 95  // High confidence for custom names
    }));
    console.log('Generated emails from custom names:', customEmails);
    allEmails.push(...customEmails);
  } else {
    console.log('Custom names not processed:');
    console.log('  useCustomNames:', useCustomNames);
    console.log('  selectedCustomNames:', selectedCustomNames);
    console.log('  selectedCustomNames.length:', selectedCustomNames?.length);
  }

  // Sort by confidence (highest first) and remove duplicates
  const uniqueEmailsWithConfidence = [];
  const seenEmails = new Set();
  
  allEmails
    .sort((a, b) => b.confidence - a.confidence)
    .forEach(email => {
      if (!seenEmails.has(email.email)) {
        seenEmails.add(email.email);
        uniqueEmailsWithConfidence.push(email);
      }
    });

  console.log('Total unique emails generated:', uniqueEmailsWithConfidence.length);
  return uniqueEmailsWithConfidence;
}

module.exports = { permute };