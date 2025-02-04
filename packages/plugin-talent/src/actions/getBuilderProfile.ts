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
      const cleanQuery = query.startsWith('@') ? query.slice(1) :
                        idMatch || 
                        query.match(/(?:for|of|about|is|builder|talent)\s+([^\s]+)/i)?.[1]?.trim() || 
                        query.replace(/(?:find|search|get|look up|tell me about)\s+(?:builder|talent|for|about)?\s*/i, '').trim();
      console.log('Cleaned query:', cleanQuery);
      
      // Check if it's a direct lookup
      const isAddress = cleanQuery.startsWith('0x');
      const isId = idMatch !== undefined;
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

          const response = formatSingleBuilderResponse(enrichedBuilder);
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
            text: formatSingleBuilderResponse(passport),
            data: { builder: passport },
            state: { lastViewedProfile: passport }
          });
          return;
        }
      }

      // Multiple results - return summarized list
      console.log(`✅ Returning ${passports.length} builders`);
      callback({
        text: formatMultipleBuilderResponse(passports),
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

function formatSingleBuilderResponse(builder: any): string {
  const profile = builder.passport_profile;
  let response = `🏗️ Builder Profile: ${profile.display_name}\n\n`;
  
  response += `📊 Builder Score: ${builder.score}\n`;
  if (profile.location) response += `📍 Location: ${profile.location}\n`;
  if (profile.bio) response += `💡 Bio: ${profile.bio}\n`;
  
  if (builder.human_checkmark) response += `✓ Verified Builder\n`;
  if (profile.tags?.length) {
    response += `🛠️ Skills: ${profile.tags.join(', ')}\n`;
  }

  if (builder.credentials?.length) {
    const validCredentials = builder.credentials.filter((cred: any) => {
      // Check if credential has a score
      if (cred.score > 0) return true;
      
      // Check if credential has a meaningful value
      if (!cred.value) return false;
      if (typeof cred.value !== 'string') return false;
      if (cred.value === 'null') return false;
      if (cred.value === '0') return false;
      if (cred.value.startsWith('0 ')) return false;
      if (cred.value === 'Level 0') return false;
      if (cred.value === 'Humanity Score: 0') return false;
      if (cred.value === 'Daily Allowance: 0') return false;
      
      return true;
    });

    if (validCredentials.length) {
      // Group credentials by category
      const groupedCreds = validCredentials.reduce((acc: any, cred: any) => {
        const category = cred.category || 'Other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(cred);
        return acc;
      }, {});

      response += `\n🏆 Notable Credentials:\n`;
      
      // Order categories
      const categoryOrder = ['Identity', 'Skills', 'Activity'];
      const sortedCategories = [...categoryOrder, ...Object.keys(groupedCreds).filter(c => !categoryOrder.includes(c))];
      
      sortedCategories.forEach(category => {
        if (groupedCreds[category]?.length) {
          response += `\n${category}:\n`;
          groupedCreds[category]
            .sort((a: any, b: any) => b.score - a.score)
            .forEach((cred: any) => {
              let credText = `• ${cred.name}`;
              if (cred.value && typeof cred.value === 'string' && 
                  !cred.value.toLowerCase().includes(cred.name.toLowerCase()) &&
                  cred.value !== 'Member') {
                credText += `: ${cred.value}`;
              }
              response += `${credText}\n`;
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

function formatMultipleBuilderResponse(builders: TalentPassport[]): string {
  if (!builders.length) {
    return "No builders found matching your criteria. Try different search terms!";
  }

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
      // Truncate bio if too long
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