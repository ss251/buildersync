import type { Plugin } from '@elizaos/core';
import { getBuilderProfileAction } from './actions/getBuilderProfile';
// import { findHackathonTeamAction } from './actions/findHackathonTeam';

// Log each action as we import it
console.log('🔌 Talent Plugin: Loading actions...');
console.log('- getBuilderProfileAction:', getBuilderProfileAction?.name);
// console.log('- findHackathonTeamAction:', findHackathonTeamAction?.name);

export const talentPlugin: Plugin = {
  name: 'talent',
  description: 'Talent Protocol plugin for discovering and connecting with web3 builders',
  actions: [
    getBuilderProfileAction,
    // findHackathonTeamAction
  ]
};

// Export everything needed
export * from './types';
export * from './services';
export { getBuilderProfileAction } from './actions/getBuilderProfile';
// export { findHackathonTeamAction } from './actions/findHackathonTeam';
export default talentPlugin; // Add default export

// Log available actions
console.log('🎯 Talent Protocol Plugin Actions:');
console.log('- get_builder_profile');
console.log('- findHackathonTeam');