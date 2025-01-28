import {
    type Provider,
    type IAgentRuntime,
    type Memory,
    type State,
    logger,
} from "@elizaos/runtime";

export const sampleProvider: Provider = {
    // biome-ignore lint: 'runtime' is intentionally unused
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        // Data retrieval logic for the provider
        logger.log("Retrieving data in sampleProvider...");
    },
};
