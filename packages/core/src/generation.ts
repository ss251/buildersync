import { bedrock } from "@ai-sdk/amazon-bedrock";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { fal } from "@fal-ai/client";

export * from "./provider/index.ts";
import { splitChunks } from "./provider/text.ts";
export { generateText, splitChunks };

    import {
        generateObject as aiGenerateObject,
        type StepResult as AIStepResult,
        type CoreTool,
        type GenerateObjectResult
    } from "ai";
    import { Buffer } from "node:buffer";
    import { createOllama } from "ollama-ai-provider";
    import OpenAI from "openai";
    import Together from "together-ai";
    import { elizaLogger } from "./index.ts";
    import {
        getEndpoint,
        getImageModelSettings,
        models
    } from "./models.ts";
    import {
        parseActionResponseFromText
    } from "./parsing.ts";
    import { generateObjectDeprecated, generateText, getCloudflareGatewayBaseURL } from "./provider/index.ts";
    import type { ProviderOptions } from "./provider/interfaces.ts";
    import {
        type ActionResponse,
        type IAgentRuntime,
        type IImageDescriptionService,
        type ModelClass,
        ModelProviderName,
        ServiceType
    } from "./types.ts";


type Tool = CoreTool<any, any>;
type StepResult = AIStepResult<any>;



// /**
//  * Get OnChain EternalAI System Prompt
//  * @returns System Prompt
//  */
// async function getOnChainEternalAISystemPrompt(
//     runtime: IAgentRuntime
// ): Promise<string> | undefined {
//     const agentId = runtime.getSetting("ETERNALAI_AGENT_ID");
//     const providerUrl = runtime.getSetting("ETERNALAI_RPC_URL");
//     const contractAddress = runtime.getSetting(
//         "ETERNALAI_AGENT_CONTRACT_ADDRESS"
//     );
//     if (agentId && providerUrl && contractAddress) {
//         // get on-chain system-prompt
//         const contractABI = [
//             {
//                 inputs: [
//                     {
//                         internalType: "uint256",
//                         name: "_agentId",
//                         type: "uint256",
//                     },
//                 ],
//                 name: "getAgentSystemPrompt",
//                 outputs: [
//                     { internalType: "bytes[]", name: "", type: "bytes[]" },
//                 ],
//                 stateMutability: "view",
//                 type: "function",
//             },
//         ];

//         const publicClient = createPublicClient({
//             transport: http(providerUrl),
//         });

//         try {
//             const validAddress: `0x${string}` =
//                 contractAddress as `0x${string}`;
//             const result = await publicClient.readContract({
//                 address: validAddress,
//                 abi: contractABI,
//                 functionName: "getAgentSystemPrompt",
//                 args: [new BigNumber(agentId)],
//             });
//             if (result) {
//                 elizaLogger.info("on-chain system-prompt response", result[0]);
//                 const value = result[0].toString().replace("0x", "");
//                 const content = Buffer.from(value, "hex").toString("utf-8");
//                 elizaLogger.info("on-chain system-prompt", content);
//                 return await fetchEternalAISystemPrompt(runtime, content);
//             } else {
//                 return undefined;
//             }
//         } catch (error) {
//             elizaLogger.error(error);
//             elizaLogger.error("err", error);
//         }
//     }
//     return undefined;
// }

// /**
//  * Fetch EternalAI System Prompt
//  * @returns System Prompt
//  */
// async function fetchEternalAISystemPrompt(
//     runtime: IAgentRuntime,
//     content: string
// ): Promise<string> | undefined {
//     const IPFS = "ipfs://";
//     const containsSubstring: boolean = content.includes(IPFS);
//     if (containsSubstring) {
//         const lightHouse = content.replace(
//             IPFS,
//             "https://gateway.lighthouse.storage/ipfs/"
//         );
//         elizaLogger.info("fetch lightHouse", lightHouse);
//         const responseLH = await fetch(lightHouse, {
//             method: "GET",
//         });
//         elizaLogger.info("fetch lightHouse resp", responseLH);
//         if (responseLH.ok) {
//             const data = await responseLH.text();
//             return data;
//         } else {
//             const gcs = content.replace(
//                 IPFS,
//                 "https://cdn.eternalai.org/upload/"
//             );
//             elizaLogger.info("fetch gcs", gcs);
//             const responseGCS = await fetch(gcs, {
//                 method: "GET",
//             });
//             elizaLogger.info("fetch lightHouse gcs", responseGCS);
//             if (responseGCS.ok) {
//                 const data = await responseGCS.text();
//                 return data;
//             } else {
//                 throw new Error("invalid on-chain system prompt");
//             }
//         }
//     } else {
//         return content;
//     }
// }






export const generateCaption = async (
    data: { imageUrl: string },
    runtime: IAgentRuntime
): Promise<{
    title: string;
    description: string;
}> => {
    const { imageUrl } = data;
    const imageDescriptionService =
        runtime.getService<IImageDescriptionService>(
            ServiceType.IMAGE_DESCRIPTION
        );

    if (!imageDescriptionService) {
        throw new Error("Image description service not found");
    }

    const resp = await imageDescriptionService.describeImage(imageUrl);
    return {
        title: resp.title.trim(),
        description: resp.description.trim(),
    };
};


/**
 * Handles AI generation based on the specified provider.
 *
 * @param {ProviderOptions} options - Configuration options specific to the provider.
 * @returns {Promise<any[]>} - A promise that resolves to an array of generated objects.
 */
export async function handleProvider(
    options: ProviderOptions
): Promise<GenerateObjectResult<unknown>> {
    const {
        provider,
        runtime,
        context,
        modelClass,
        //verifiableInference,
        //verifiableInferenceAdapter,
        //verifiableInferenceOptions,
    } = options;
    switch (provider) {
        case ModelProviderName.OPENAI:
        case ModelProviderName.ETERNALAI:
        case ModelProviderName.ALI_BAILIAN:
        case ModelProviderName.VOLENGINE:
        case ModelProviderName.LLAMACLOUD:
        case ModelProviderName.TOGETHER:
        case ModelProviderName.NANOGPT:
        case ModelProviderName.AKASH_CHAT_API:
        case ModelProviderName.LMSTUDIO:
            return await handleOpenAI(options);
        case ModelProviderName.ANTHROPIC:
        case ModelProviderName.CLAUDE_VERTEX:
            return await handleAnthropic(options);
        case ModelProviderName.GROK:
            return await handleGrok(options);
        case ModelProviderName.GROQ:
            return await handleGroq(options);
        case ModelProviderName.LLAMALOCAL:
            return await generateObjectDeprecated({
                runtime,
                context,
                modelClass,
            });
        case ModelProviderName.GOOGLE:
            return await handleGoogle(options);
        case ModelProviderName.MISTRAL:
            return await handleMistral(options);
        case ModelProviderName.REDPILL:
            return await handleRedPill(options);
        case ModelProviderName.OPENROUTER:
            return await handleOpenRouter(options);
        case ModelProviderName.OLLAMA:
            return await handleOllama(options);
        case ModelProviderName.DEEPSEEK:
            return await handleDeepSeek(options);
        case ModelProviderName.LIVEPEER:
            return await handleLivepeer(options);
        default: {
            const errorMessage = `Unsupported provider: ${provider}`;
            elizaLogger.error(errorMessage);
            throw new Error(errorMessage);
        }
    }
}
/**
 * Handles object generation for OpenAI.
 *
 * @param {ProviderOptions} options - Options specific to OpenAI.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleOpenAI({
    model,
    apiKey,
    schema,
    schemaName,
    schemaDescription,
    mode = "json",
    modelOptions,
    provider: _provider,
    runtime,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    const baseURL =
        getCloudflareGatewayBaseURL(runtime, "openai") ||
        models.openai.endpoint;
    const openai = createOpenAI({ apiKey, baseURL });
    return await aiGenerateObject({
        model: openai.languageModel(model),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

/**
 * Handles object generation for Anthropic models.
 *
 * @param {ProviderOptions} options - Options specific to Anthropic.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleAnthropic({
    model,
    apiKey,
    schema,
    schemaName,
    schemaDescription,
    mode = "json",
    modelOptions,
    runtime,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    elizaLogger.debug("Handling Anthropic request with Cloudflare check");
    const baseURL = getCloudflareGatewayBaseURL(runtime, "anthropic");
    elizaLogger.debug("Anthropic handleAnthropic baseURL:", { baseURL });

    const anthropic = createAnthropic({ apiKey, baseURL });
    return await aiGenerateObject({
        model: anthropic.languageModel(model),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

/**
 * Handles object generation for Grok models.
 *
 * @param {ProviderOptions} options - Options specific to Grok.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleGrok({
    model,
    apiKey,
    schema,
    schemaName,
    schemaDescription,
    mode = "json",
    modelOptions,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    const grok = createOpenAI({ apiKey, baseURL: models.grok.endpoint });
    return await aiGenerateObject({
        model: grok.languageModel(model, { parallelToolCalls: false }),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

/**
 * Handles object generation for Groq models.
 *
 * @param {ProviderOptions} options - Options specific to Groq.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleGroq({
    model,
    apiKey,
    schema,
    schemaName,
    schemaDescription,
    mode = "json",
    modelOptions,
    runtime,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    elizaLogger.debug("Handling Groq request with Cloudflare check");
    const baseURL = getCloudflareGatewayBaseURL(runtime, "groq");
    elizaLogger.debug("Groq handleGroq baseURL:", { baseURL });

    const groq = createGroq({ apiKey, baseURL });
    return await aiGenerateObject({
        model: groq.languageModel(model),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

/**
 * Handles object generation for Google models.
 *
 * @param {ProviderOptions} options - Options specific to Google.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleGoogle({
    model,
    apiKey: _apiKey,
    schema,
    schemaName,
    schemaDescription,
    mode = "json",
    modelOptions,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    const google = createGoogleGenerativeAI();
    return await aiGenerateObject({
        model: google(model),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

/**
 * Handles object generation for Mistral models.
 *
 * @param {ProviderOptions} options - Options specific to Mistral.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleMistral({
    model,
    schema,
    schemaName,
    schemaDescription,
    mode,
    modelOptions,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    const mistral = createMistral();
    return await aiGenerateObject({
        model: mistral(model),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

/**
 * Handles object generation for Redpill models.
 *
 * @param {ProviderOptions} options - Options specific to Redpill.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleRedPill({
    model,
    apiKey,
    schema,
    schemaName,
    schemaDescription,
    mode = "json",
    modelOptions,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    const redPill = createOpenAI({ apiKey, baseURL: models.redpill.endpoint });
    return await aiGenerateObject({
        model: redPill.languageModel(model),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

/**
 * Handles object generation for OpenRouter models.
 *
 * @param {ProviderOptions} options - Options specific to OpenRouter.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleOpenRouter({
    model,
    apiKey,
    schema,
    schemaName,
    schemaDescription,
    mode = "json",
    modelOptions,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    const openRouter = createOpenAI({
        apiKey,
        baseURL: models.openrouter.endpoint,
    });
    return await aiGenerateObject({
        model: openRouter.languageModel(model),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

/**
 * Handles object generation for Ollama models.
 *
 * @param {ProviderOptions} options - Options specific to Ollama.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleOllama({
    model,
    schema,
    schemaName,
    schemaDescription,
    mode = "json",
    modelOptions,
    provider,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    const ollamaProvider = createOllama({
        baseURL: `${getEndpoint(provider)}/api`,
    });
    const ollama = ollamaProvider(model);
    return await aiGenerateObject({
        model: ollama,
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

/**
 * Handles object generation for DeepSeek models.
 *
 * @param {ProviderOptions} options - Options specific to DeepSeek.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleDeepSeek({
    model,
    apiKey,
    schema,
    schemaName,
    schemaDescription,
    mode,
    modelOptions,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    const openai = createOpenAI({ apiKey, baseURL: models.deepseek.endpoint });
    return await aiGenerateObject({
        model: openai.languageModel(model),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

/**
 * Handles object generation for Amazon Bedrock models.
 *
 * @param {ProviderOptions} options - Options specific to Amazon Bedrock.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleBedrock({
    model,
    schema,
    schemaName,
    schemaDescription,
    mode,
    modelOptions,
    provider,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    return await aiGenerateObject({
        model: bedrock(model),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

async function handleLivepeer({
    model,
    apiKey,
    schema,
    schemaName,
    schemaDescription,
    mode,
    modelOptions,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    console.log("Livepeer provider api key:", apiKey);
    if (!apiKey) {
        throw new Error(
            "Livepeer provider requires LIVEPEER_GATEWAY_URL to be configured"
        );
    }

    const livepeerClient = createOpenAI({
        apiKey,
        baseURL: apiKey, // Use the apiKey as the baseURL since it contains the gateway URL
    });

    return await aiGenerateObject({
        model: livepeerClient.languageModel(model),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

// Add type definition for Together AI response
interface TogetherAIImageResponse {
    data: Array<{
        url: string;
        content_type?: string;
        image_type?: string;
    }>;
}

export async function generateTweetActions({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
}): Promise<ActionResponse | null> {
    let retryDelay = 1000;
    while (true) {
        try {
            const response = await generateText({
                runtime,
                context,
                modelClass,
            });
            elizaLogger.debug(
                "Received response from generateText for tweet actions:",
                response
            );
            const { actions } = parseActionResponseFromText(response.trim());
            if (actions) {
                elizaLogger.debug("Parsed tweet actions:", actions);
                return actions;
            } else {
                elizaLogger.debug("generateTweetActions no valid response");
            }
        } catch (error) {
            elizaLogger.error("Error in generateTweetActions:", error);
            if (
                error instanceof TypeError &&
                error.message.includes("queueTextCompletion")
            ) {
                elizaLogger.error(
                    "TypeError: Cannot read properties of null (reading 'queueTextCompletion')"
                );
            }
        }
        elizaLogger.log(`Retrying in ${retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
    }
}
