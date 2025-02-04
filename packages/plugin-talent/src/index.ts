import { Plugin } from '@elizaos/core';
import { searchBuildersAction } from './actions/searchBuilders';
import { getPassportAction } from './actions/getPassport';

console.log('Talent Plugin: Starting initialization...');

// Log each action as we import it
console.log('Talent Plugin: Loading actions...');
console.log('- searchBuildersAction:', searchBuildersAction?.name);
console.log('- getPassportAction:', getPassportAction?.name);

export const talentPlugin: Plugin = {
  name: 'talent',
  description: 'Talent Protocol plugin for discovering and connecting with web3 builders',
  actions: [
    searchBuildersAction,
    getPassportAction
  ]
};

console.log('Talent Plugin: Configuration:', {
  name: talentPlugin.name,
  description: talentPlugin.description,
  actionCount: talentPlugin.actions.length,
  actionNames: talentPlugin.actions.map(a => a.name)
});

export default talentPlugin;