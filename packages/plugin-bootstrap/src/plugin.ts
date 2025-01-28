import { createPlugin } from "@elizaos/core";
import { fileActions, getWeather } from "./actions";

export const bootstrapPlugin = createPlugin({
  name: "bootstrap",
  description: "",
  actions: [
    ...fileActions,
    getWeather
  ]
})