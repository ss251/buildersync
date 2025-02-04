import { Action, HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import { validateTalentConfig } from '../environment';
import { TalentService } from '../services';
import { searchBuilderExamples } from '../examples';

export const searchBuildersAction: Action = {
  name: 'talent_search_builders',
  description: 'Search for builders on Talent Protocol based on skills, location, or other criteria',
  similes: ['find builders', 'search developers', 'look for builders', 'show me builders', 'get builders'],
  examples: searchBuilderExamples,
  
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
    const config = validateTalentConfig(runtime);
    const talentService = new TalentService(config);

    const messageText = message.content.text.toLowerCase();
    console.log('Search criteria:', { messageText });

    try {
      let builders;
      if (messageText.includes('top')) {
        builders = await talentService.getTopBuilders(10);
      } else {
        builders = await talentService.searchBuilders(messageText);
      }

      if (!builders || builders.length === 0) {
        const locationTerms = ['in', 'from', 'at', 'near'];
        const hasLocation = locationTerms.some(term => messageText.includes(term));
        
        callback({
          text: hasLocation 
            ? "I couldn't find any builders in that location. Try searching for a different area or removing the location filter."
            : "I couldn't find any builders matching your criteria. Try different search terms or skills."
        });
        return;
      }

      // Filter builders by location if searching for a specific region
      if (messageText.includes('asia')) {
        builders = builders.filter(builder => {
          const location = (builder.passport_profile.location || '').toLowerCase();
          return location.includes('asia') || 
                 location.includes('singapore') || 
                 location.includes('japan') || 
                 location.includes('korea') ||
                 location.includes('china') ||
                 location.includes('india') ||
                 location.includes('hong kong') ||
                 location.includes('taiwan');
        });
      }

      let responseText = `Here are ${builders.length > 1 ? 'the' : ''} ${builders.length} ${builders.length > 1 ? 'builders' : 'builder'} I found:\n\n`;
      
      builders.forEach((builder, index) => {
        const displayName = builder.passport_profile.display_name || 'Anonymous Builder';
        const score = Math.round((builder.score || 0));
        
        responseText += `${index + 1}. ${displayName}\n`;
        responseText += `   Builder Score: ${score}\n`;
        
        if (builder.passport_profile.location) {
          responseText += `   📍 ${builder.passport_profile.location}\n`;
        }
        
        if (builder.passport_profile.tags?.length) {
          responseText += `   🛠️ Skills: ${builder.passport_profile.tags.join(', ')}\n`;
        }
        
        if (builder.passport_profile.bio) {
          const bio = builder.passport_profile.bio.slice(0, 100);
          responseText += `   💡 ${bio}${bio.length >= 100 ? '...' : ''}\n`;
        }
        
        if (builder.human_checkmark) {
          responseText += `   ✓ Verified Builder\n`;
        }
        responseText += '\n';
      });

      if (builders.length === 0) {
        callback({
          text: "I couldn't find any builders in Asia. Would you like to see top builders from other regions instead?"
        });
        return;
      }

      callback({
        text: responseText,
        state: {
          lastSearchResults: builders
        }
      });
    } catch (error) {
      console.error('Error searching builders:', error);
      
      if (error.message.includes('Authentication failed')) {
        callback({
          text: "I'm having trouble accessing the Talent Protocol API. Please check that your API key is valid and try again."
        });
        return;
      }

      callback({
        text: "I encountered an error while searching for builders. This might be due to API rate limits or temporary issues. Please try again in a moment."
      });
    }
  }
};