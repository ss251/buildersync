import { InventoryAction, IAgentRuntime, ActionHandlerCallback } from "@elizaos/core";
import { z } from "zod";

export const swapAction: InventoryAction = {
    name: 'swap',
    description: 'Swap one inventory item for another',
    parameters: z.object({
      fromContractAddress: z.string(),
      toContractAddress: z.string(),
      quantity: z.number(),
    }),
    handler: async (_runtime: IAgentRuntime<any>, params: any, _callback: ActionHandlerCallback | undefined) => {
      console.log("Swapping", params);
      return JSON.stringify(params.item);
    },
  };