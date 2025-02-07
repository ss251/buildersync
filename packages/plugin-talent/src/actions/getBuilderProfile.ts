import { Action, HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import { TalentService } from '../services';
import { BuilderProfile, TalentPassport } from '../types';
import { validateTalentConfig } from '../environment';

export const getBuilderProfileAction: Action = {
  name: 'talent_get_builder_profile',
  description: 'Get a builder profile or search for builders',
  similes: [
    'find builder',
    'search builder', 
    'get builder',
    'find talent',
    'search talent',
    'get builder profile',
    'find builder profile',
    'search for builder',
    'look up builder',
    'who is',
    'tell me about',
    'talent id',
    'find id',
    '@'
  ],
  examples: [
    [
      {
        user: 'user1',
        content: { text: 'find builder thescoho' }
      },
      {
        user: 'agent',
        content: { text: 'Here is the builder profile for thescoho...' }
      }
    ],
    [
      {
        user: 'user1',
        content: { text: 'talent id 4458' }
      },
      {
        user: 'agent',
        content: { text: 'Here is the builder profile for talent ID 4458...' }
      }
    ],
    [
      {
        user: 'user1',
        content: { text: '@thescoho' }
      },
      {
        user: 'agent',
        content: { text: 'Here is the builder profile for @thescoho...' }
      }
    ]
  ],
  async validate(runtime) {
    try {
      validateTalentConfig(runtime);
      return true;
    } catch {
      return false;
    }
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: HandlerCallback
  ) => {
    console.log('🔍 talent_get_builder_profile action triggered');
    console.log('Message:', JSON.stringify(message, null, 2));
    
    try {
      const config = validateTalentConfig(runtime);
      const service = new TalentService(config);
      const query = message?.content?.text || message?.content;
      console.log('Query extracted:', query);
      
      if (!query || typeof query !== 'string') {
        console.log('❌ Invalid query:', query);
        callback({
          text: 'Please provide a search term, wallet address, or talent ID',
          error: true
        });
        return;
      }

      // Clean up the query - extract name after common patterns
      const idMatch = query.match(/(?:id|#)\s*(\d+)/i)?.[1];
      const cleanQuery = idMatch || // If we found an ID, use it directly
        (query.startsWith('@') ? 
          query.slice(1).split(/\s+/).slice(1).join(' ') : // Remove @ and first word for mentions
          query.match(/(?:for|of|about|is|builder|talent)\s+([^\s]+)/i)?.[1]?.trim() || 
          query.replace(/(?:find|search|get|look up|tell me about)\s+(?:builder|talent|for|about)?\s*/i, '').trim()
        );
      console.log('Cleaned query:', cleanQuery);
      
      // Check if it's a direct lookup
      const isAddress = cleanQuery.startsWith('0x');
      const isId = /^\d+$/.test(cleanQuery); // Check if query is just a number
      console.log('Is wallet address?', isAddress);
      console.log('Is talent ID?', isId);
      
      let passports: TalentPassport[] = [];

      try {
        if (isAddress) {
          console.log('📡 Fetching by wallet address:', cleanQuery);
          // Direct wallet lookup
          const passport = await service.getPassport(cleanQuery);
          console.log('Found passport by address:', passport?.passport_id);
          passports = [passport];
        } else if (isId) {
          console.log('📡 Fetching by talent ID:', cleanQuery);
          // Direct ID lookup
          const passport = await service.getPassportById(cleanQuery);
          console.log('Found passport by ID:', passport?.passport_id);
          passports = [passport];
        } else {
          console.log('📡 Searching builders by name:', cleanQuery);
          // Search by keyword/name
          const searchResponse = await service.searchBuilders({ name: cleanQuery });
          console.log(`Found ${searchResponse?.length || 0} builders`);
          passports = searchResponse;
        }
      } catch (error) {
        console.error('API Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        
        if (error.response?.status === 404) {
          callback({
            text: `No builders found matching "${cleanQuery}". Try different search terms!`,
            data: { builders: [] }
          });
          return;
        }
        throw error;
      }

      // Detect if the client is Twitter based on message source
      const isTwitter = message.content?.source === 'twitter';
      
      // If we got exactly one result, fetch additional credentials
      if (passports.length === 1) {
        const passport = passports[0];
        console.log('Single builder found, fetching credentials for ID:', passport.passport_id);
        
        try {
          const credentials = await service.getPassportCredentials(passport.passport_id.toString());
          console.log(`Found ${credentials?.length || 0} credentials`);
          
          // Combine passport and credentials data
          const enrichedBuilder = {
            ...passport,
            credentials
          };

          const response = formatSingleBuilderResponse(enrichedBuilder, isTwitter);
          console.log('✅ Returning enriched builder profile');
          
          callback({
            text: response,
            data: { builder: enrichedBuilder },
            state: { lastViewedProfile: enrichedBuilder }
          });
          return;
        } catch (error) {
          console.error('Failed to fetch credentials:', error);
          // Continue with just passport data if credentials fetch fails
          console.log('⚠️ Returning builder profile without credentials');
          
          callback({
            text: formatSingleBuilderResponse(passport, isTwitter),
            data: { builder: passport },
            state: { lastViewedProfile: passport }
          });
          return;
        }
      }

      // Multiple results - return summarized list
      console.log(`✅ Returning ${passports.length} builders`);
      callback({
        text: formatMultipleBuilderResponse(passports, isTwitter),
        data: { builders: passports },
        state: { lastSearchResults: passports }
      });

    } catch (error) {
      console.error('❌ Error in getBuilderProfile:', error);
      callback({
        text: error.message.includes('Authentication failed')
          ? "I'm having trouble accessing the Talent Protocol API. Please check that your API key is valid and try again."
          : "I encountered an error while searching for builders. This might be due to API rate limits or temporary issues. Please try again in a moment.",
        error: true
      });
    }
  }
};

// Constants for Twitter character limits
const TWITTER_MAX_LENGTH = 280;
const TWITTER_URL_LENGTH = 23;
const TWITTER_SAFETY_MARGIN = 20; // Reduced since we'll be more precise now
const MAX_CREDS_PER_CHUNK = 5; // New constant to limit credentials per chunk

function countTwitterChars(text: string): number {
  // First normalize the text to NFC form as Twitter does
  const normalizedText = text.normalize('NFC');
  
  // Replace URLs with placeholder of correct length
  const urlRegex = /https?:\/\/[^\s]+/g;
  const textWithoutUrls = normalizedText.replace(urlRegex, 'X'.repeat(TWITTER_URL_LENGTH));
  
  // Count CJK characters (they count as 2)
  const cjkRegex = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uf900-\ufaff]/g;
  const cjkChars = textWithoutUrls.match(cjkRegex) || [];
  const cjkLength = cjkChars.length;
  
  // Count emojis (they count as 2)
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]|\u200D[\u2640-\u2642]|\u200D[\u2600-\u2B55]|\u200D[\u{1F300}-\u{1F9FF}]|\u200D[\u{1F600}-\u{1F64F}]|\u200D[\u{1F680}-\u{1F6FF}]|\u200D[\u{2600}-\u{26FF}]|\u200D[\u{2700}-\u{27BF}]/gu;
  const emojis = textWithoutUrls.match(emojiRegex) || [];
  const emojiLength = emojis.length;
  
  // Base length is the string length minus the extra char for CJK and emojis
  const baseLength = textWithoutUrls.length;
  
  // Total length adds an extra char for each CJK and emoji
  return baseLength + cjkLength + emojiLength;
}

function formatCredential(cred: any): string | null {
  // Skip truly empty/invalid credentials
  if (!cred.value || 
      cred.value === 'null' || 
      cred.value === 'undefined' || 
      cred.value === '') {
    return null;
  }

  // Ensure value is a string before using string methods
  const value = String(cred.value);

  // Skip credentials with 0 values
  if (value.includes('0 contracts') ||
      value.includes('0 NFTs') ||
      value === '0 tokens staked' ||
      value === 'Daily Allowance: 0' ||
      value === 'No GCR tokens' ||
      value === 'Level 0' ||
      value === 'Humanity Score: 0' ||
      value === '0 $BUILD Committed' ||
      value === '0') {
    return null;
  }

  let credText = '';
  
  // Special formatting for specific credential types
  switch(cred.type) {
    case 'ens':
      credText = `• ENS: https://app.ens.domains/${value}\n`;
      break;
    case 'basename':
      credText = `• Basename: https://www.base.org/name/${value}\n`;
      break;
    case 'lens':
      const lensHandles = value.split(',').map(h => h.trim().replace('@', ''));
      credText = `• Lens: ${lensHandles.join(', ')}\n`;
      break;
    case 'farcaster': {
      const match = value.match(/FID: (\d+)/);
      if (match) {
        credText = `• Farcaster: https://warpcast.com/~/profiles/${match[1]}\n`;
      }
      break;
    }
    case 'linkedin':
      if (value) {
        const linkedinUsername = value.replace(/^https?:\/\/(?:www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '');
        credText = `• LinkedIn: https://linkedin.com/in/${linkedinUsername}\n`;
      }
      break;
    case 'twitter':
      credText = `• Twitter/X: @${value.replace('@', '')}\n`;
      break;
    case 'github': {
      // Parse GitHub info - format: "Since YYYY-MM-DD, Total Contributions: X"
      const match = value.match(/Since ([\d-]+)/);
      if (match) {
        credText = `• GitHub: Since ${match[1]}\n`;
      }
      break;
    }
    case 'github_developer': {
      const match = value.match(/(\d+) contributions/);
      if (match) {
        credText = `• GitHub: ${match[1]} contributions\n`;
      }
      break;
    }
    case 'build': {
      // Only show if amount > 0
      const amount = parseFloat(value.match(/[\d.]+/)?.[0] || '0');
      if (amount > 0) {
        credText = `• ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $BUILD Committed\n`;
      }
      break;
    }
    case 'developer_dao':
      credText = `• Developer DAO: ${value}\n`;
      break;
    case 'base_builder':
      credText = `• Base Developer: ${value}\n`;
      break;
    case 'eth_global':
      credText = `• ETHGlobal: ${value}\n`;
      break;
    case 'gitcoin':
      credText = `• Gitcoin Passport: ${value}\n`;
      break;
    case 'jumper_pass':
      credText = `• Jumper Pass: ${value}\n`;
      break;
    case 'degen': {
      const match = value.match(/Daily Allowance: (\d+)/);
      if (match && parseInt(match[1]) > 0) {
        credText = `• DEGEN: ${match[1]} daily allowance\n`;
      }
      break;
    }
    default:
      // For everything else, show if it has a meaningful value
      if (value && value !== '0' && !value.startsWith('0 ')) {
        credText = `• ${cred.name}: ${value}\n`;
      }
  }

  return credText;
}

function formatSingleBuilderResponse(builder: any, isTwitter: boolean = false): string {
  const profile = builder.passport_profile;
  
  if (!isTwitter) {
    // Default non-Twitter formatting
    let response = `🏗️ Builder Profile: ${profile.display_name}\n`;
    response += `🔗 https://app.talentprotocol.com/profile/${builder.passport_id}\n\n`;
    response += `📊 Builder Score: ${builder.score}\n`;
    if (profile.location) response += `📍 Location: ${profile.location}\n`;
    if (profile.bio) response += `💡 Bio: ${profile.bio}\n`;
    if (builder.human_checkmark) response += `✓ Verified Builder\n`;
    
    if (profile.tags?.length) {
      response += `🛠️ Skills: ${profile.tags.join(', ')}\n`;
    }

    // Group and filter credentials
    if (builder.credentials?.length) {
      const groupedCreds = builder.credentials.reduce((acc: any, cred: any) => {
        const formattedCred = formatCredential(cred);
        if (formattedCred) {  // Only include if formatting returned a value
          const category = cred.category || 'Other';
          if (!acc[category]) acc[category] = [];
          acc[category].push({ ...cred, formatted: formattedCred });
        }
        return acc;
      }, {});

      // Only add credentials section if we have valid credentials
      if (Object.keys(groupedCreds).length > 0) {
        response += `\n🏆 Notable Credentials:\n`;
        
        const categoryOrder = ['Identity', 'Skills', 'Activity'];
        const sortedCategories = [...categoryOrder, ...Object.keys(groupedCreds).filter(c => !categoryOrder.includes(c))];
        
        sortedCategories.forEach(category => {
          if (groupedCreds[category]?.length) {
            response += `\n${category}:\n`;
            groupedCreds[category]
              .sort((a: any, b: any) => b.score - a.score)
              .forEach((cred: any) => {
                response += cred.formatted;
              });
          }
        });
      }
    }

    if (builder.verified_wallets?.length) {
      response += `\n💳 Verified Wallets:\n`;
      builder.verified_wallets.forEach((wallet: string) => {
        response += `• ${wallet}\n`;
      });
    }

    return response;
  }

  // Twitter-specific chunked formatting
  const chunks: string[] = [];
  
  // First chunk: Basic info
  let mainChunk = `🏗️ Builder Profile: ${profile.display_name}\n`;
  mainChunk += `🔗 https://app.talentprotocol.com/profile/${builder.passport_id}\n\n`;
  mainChunk += `📊 Score: ${builder.score}`;
  if (builder.human_checkmark) mainChunk += ' ✓';
  mainChunk += '\n';
  
  if (profile.location) mainChunk += `📍 ${profile.location}\n`;
  if (profile.bio) mainChunk += `💡 ${profile.bio}\n`;
  if (profile.tags?.length) mainChunk += `🛠️ Skills: ${profile.tags.join(', ')}\n`;
  chunks.push(mainChunk);

  // Group and filter credentials
  if (builder.credentials?.length) {
    const groupedCreds = builder.credentials.reduce((acc: any, cred: any) => {
      const formattedCred = formatCredential(cred);
      if (formattedCred) {
        const category = cred.category || 'Other';
        if (!acc[category]) acc[category] = [];
        acc[category].push({ ...cred, formatted: formattedCred, score: cred.score || 0 });
      }
      return acc;
    }, {});

    if (Object.keys(groupedCreds).length > 0) {
      const categoryOrder = ['Identity', 'Skills', 'Activity'];
      const sortedCategories = [...categoryOrder, ...Object.keys(groupedCreds).filter(c => !categoryOrder.includes(c))];
      
      sortedCategories.forEach(category => {
        if (!groupedCreds[category]?.length) return;

        // Sort credentials by score within category
        const sortedCreds = groupedCreds[category].sort((a: any, b: any) => b.score - a.score);
        
        let currentChunk = `• ${category}:\n`;
        let credsInCurrentChunk = 0;

        sortedCreds.forEach((cred: any) => {
          const credText = cred.formatted;
          const potentialChunk = currentChunk + credText;

          // Now we use exact Twitter character counting
          if (countTwitterChars(potentialChunk) > TWITTER_MAX_LENGTH - TWITTER_SAFETY_MARGIN) {
            // Save current chunk and start new one
            if (currentChunk !== `• ${category}:\n`) {
              chunks.push(currentChunk.trim());
            }
            currentChunk = `• ${category} (cont.):\n${credText}`;
          } else {
            currentChunk += credText;
          }
        });

        // Add final chunk for this category if it exists
        if (currentChunk !== `• ${category}:\n`) {
          chunks.push(currentChunk.trim());
        }
      });
    }
  }

  // Handle wallets separately
  if (builder.verified_wallets?.length) {
    let walletChunk = `💳 Verified Wallets:\n`;
    let walletsInChunk = 0;

    builder.verified_wallets.forEach((wallet: string) => {
      const line = `• ${wallet}\n`;
      const potentialChunk = walletChunk + line;

      if (walletsInChunk >= MAX_CREDS_PER_CHUNK || 
          countTwitterChars(potentialChunk) > TWITTER_MAX_LENGTH - TWITTER_SAFETY_MARGIN) {
        chunks.push(walletChunk.trim());
        walletChunk = `💳 Verified Wallets (cont.):\n${line}`;
        walletsInChunk = 1;
      } else {
        walletChunk += line;
        walletsInChunk++;
      }
    });

    if (walletChunk !== `💳 Verified Wallets:\n`) {
      chunks.push(walletChunk.trim());
    }
  }

  // Add thread markers and join chunks
  return chunks.map((chunk, i) => {
    const threadMarker = i < chunks.length - 1 ? `\n\n🧵 ${i + 2}/${chunks.length}` : '';
    return chunk.trim() + threadMarker;
  }).join('\n\n---\n\n');
}

function formatMultipleBuilderResponse(builders: TalentPassport[], isTwitter: boolean = false): string {
  if (!builders.length) {
    return "No builders found matching your criteria. Try different search terms!";
  }

  if (!isTwitter) {
    // Default non-Twitter formatting
    let response = `Found ${builders.length} builders:\n\n`;
    
    builders.forEach((builder, index) => {
      const profile = builder.passport_profile;
      response += `${index + 1}. ${profile.display_name}\n`;
      response += `   Builder Score: ${builder.score}\n`;
      
      if (profile.location) {
        response += `   📍 ${profile.location}\n`;
      }
      
      if (profile.tags?.length) {
        response += `   🛠️ ${profile.tags.join(', ')}\n`;
      }
      
      if (profile.bio) {
        const truncatedBio = profile.bio.length > 100 ? 
          profile.bio.substring(0, 97) + '...' : 
          profile.bio;
        response += `   💡 ${truncatedBio}\n`;
      }
      
      if (builder.human_checkmark) {
        response += `   ✓ Verified Builder\n`;
      }
      
      response += '\n';
    });
    
    return response;
  }

  // Twitter-specific chunked formatting
  const chunks: string[] = [];
  let currentChunk = `Found ${builders.length} builders:\n\n`;
  
  builders.forEach((builder, index) => {
    const profile = builder.passport_profile;
    let builderText = `${index + 1}. ${profile.display_name}\n`;
    builderText += `   Score: ${builder.score}${builder.human_checkmark ? ' ✓' : ''}\n`;
    
    if (profile.location) {
      builderText += `   📍 ${profile.location}\n`;
    }
    
    if (profile.tags?.length) {
      builderText += `   🛠️ ${profile.tags.join(', ')}\n`;
    }
    
    if (profile.bio) {
      const truncatedBio = profile.bio.length > 100 ? 
        profile.bio.substring(0, 97) + '...' : 
        profile.bio;
      builderText += `   💡 ${truncatedBio}\n`;
    }
    
    builderText += '\n';

    // Check if adding this builder would exceed tweet limit
    if ((currentChunk + builderText).length > 240) {
      chunks.push(currentChunk.trim());
      currentChunk = builderText;
    } else {
      currentChunk += builderText;
    }
  });

  if (currentChunk) chunks.push(currentChunk.trim());

  return chunks.map((chunk, i) => 
    `${chunk}${i < chunks.length - 1 ? '\n\n🧵 cont...' : ''}`
  ).join('\n\n---\n\n');
}