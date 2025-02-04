import { Action, HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import { validateTalentConfig } from '../environment';
import { TalentService } from '../services';

export const getPassportAction: Action = {
  name: 'talent_get_passport',
  description: 'Get detailed information about a builder from their Talent Protocol passport using their wallet address or talent ID',
  similes: ['check passport', 'view passport', 'show passport', 'get builder info', 'check builder'],
  examples: [
    [{
      user: "{{user1}}",
      content: { text: "Show me the passport for 0x1358155a15930f89ebc787a34eb4ccfd9720bc62" }
    }],
    [{
      user: "{{user1}}",
      content: { text: "Get builder info for talent ID 1979" }
    }]
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
    const config = validateTalentConfig(runtime);
    const talentService = new TalentService(config);

    // Extract Ethereum address or talent ID from message
    const addressMatch = message.content.text.match(/0x[a-fA-F0-9]{40}/);
    const talentIdMatch = message.content.text.match(/(?:talent|id|passport)\s*(?:id|#)?\s*(\d+)/i);
    
    if (!addressMatch && !talentIdMatch) {
      callback({
        text: "I couldn't find a valid Ethereum address or talent ID in your message. Please provide either:\n" +
              "• A wallet address (e.g., 0x1234...)\n" +
              "• A talent ID (e.g., talent ID 1234)"
      });
      return;
    }

    try {
      const identifier = addressMatch ? addressMatch[0] : talentIdMatch![1];
      console.log('Fetching passport for:', identifier);
      
      const passport = await talentService.getPassport(identifier);
      console.log('Passport data:', JSON.stringify(passport, null, 2));

      // Format response
      let response = `🎫 Talent Passport\n`;
      response += `${'-'.repeat(30)}\n\n`;
      
      // Basic Info
      response += `👤 ${passport.passport_profile.display_name || 'Anonymous'}\n`;
      if (passport.human_checkmark) {
        response += '✓ Verified Builder\n';
      }
      response += `🆔 Passport ID: ${passport.passport_id}\n\n`;

      // Scores
      response += `🏆 Builder Scores\n`;
      response += `${'-'.repeat(20)}\n`;
      response += `📊 Overall: ${Math.round(passport.score || 0)}\n`;
      response += `⚡ Activity: ${passport.activity_score}\n`;
      response += `🎯 Identity: ${passport.identity_score}\n`;
      response += `🛠️ Skills: ${passport.skills_score}\n\n`;
      
      // Bio
      if (passport.passport_profile.bio) {
        response += `📝 Bio\n`;
        response += `${'-'.repeat(20)}\n`;
        response += `${passport.passport_profile.bio}\n\n`;
      }

      // Skills
      if (passport.passport_profile.tags?.length > 0) {
        response += `💪 Skills\n`;
        response += `${'-'.repeat(20)}\n`;
        response += passport.passport_profile.tags.map(tag => `• ${tag}`).join('\n');
        response += '\n\n';
      }

      // Location
      if (passport.passport_profile.location) {
        response += `📍 Location\n`;
        response += `${'-'.repeat(20)}\n`;
        response += `${passport.passport_profile.location}\n\n`;
      }

      // Wallets
      if (passport.verified_wallets?.length > 0) {
        response += `🔑 Verified Wallets\n`;
        response += `${'-'.repeat(20)}\n`;
        response += passport.verified_wallets.map(wallet => 
          wallet === passport.main_wallet ? 
          `• ${wallet} (Main)` : 
          `• ${wallet}`
        ).join('\n');
        response += '\n';
      }

      callback({
        text: response,
        state: {
          lastViewedPassport: passport
        }
      });
    } catch (error) {
      console.error('Error fetching passport:', error);
      
      if (error.message.includes('not found')) {
        callback({
          text: "I couldn't find a passport with that identifier. Please verify the address or talent ID and try again."
        });
        return;
      }
      
      if (error.message.includes('Authentication failed')) {
        callback({
          text: "I'm having trouble accessing the Talent Protocol API. Please check that your API key is valid and try again."
        });
        return;
      }

      callback({
        text: "I encountered an error while fetching the passport. This might be due to API rate limits or temporary issues. Please try again in a moment."
      });
    }
  }
}; 