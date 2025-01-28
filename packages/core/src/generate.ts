import {
  AnyPrompt,
  createPrompt,
  GetVisitors,
  InferGeneratePromptConfig,
  InferPromptComponents,
} from './prompt';
import { IElizaRuntime } from './types';
import {
  chatActionHandlerPromptTemplate,
  chatHandlerPromptTemplate,
  dataLoderPromptTemplate,
} from './prompts';

export type LLMParams<Model = string> = {
  model: Model;
  system?: string;
  prompt?: string;
  max_tokens: number;
  stop_sequences?: Array<string>;
  temperature?: number;
  top_k?: number;
  top_p?: number;
};

export type LLMProvider<Model extends string = string> = (
  params: LLMParams<Model>
) => Promise<string>;

export type InferLLMProviderModel<TLLMProvider extends LLMProvider<any>> =
  TLLMProvider extends LLMProvider<infer Model> ? Model : string;

// todo: debugger
export async function generateOutput<
  Output,
  TPrompt extends AnyPrompt | string = AnyPrompt,
  Components extends
    InferPromptComponents<TPrompt> = InferPromptComponents<TPrompt>,
  Visitors extends GetVisitors<Output, Components> = GetVisitors<
    Output,
    Components
  >,
>({
  runtime,
  prompt,
  visitors,
  output,
  debug,
}: {
  runtime: IElizaRuntime;
  prompt: InferGeneratePromptConfig<TPrompt>;
  visitors: Visitors;
  output: Output;
  debug?: boolean;
}): Promise<Output> {
  const id = Date.now();

  const template: AnyPrompt =
    typeof prompt.template === 'string'
      ? createPrompt(prompt.template)
      : prompt.template;

  const systemPrompt = template.render(
    prompt.variables,
    prompt.data,
    prompt.formatter
  );

  if (debug) {
  }

  const response = await runtime.call('generate::text', {
    system: systemPrompt,
    model: 'LARGE',
    prompt: '<output>',
    stop: ['</output>'],
  });

  if (debug) {
  }

  output = template.parse(response, visitors, output);

  if (debug) {
  }

  return output;
}

export type ActionCallOutput = { name: string; params: any };
export type ResponseOutput = { msgId: string; content: string };

export type ChatOutput = {
  calls: ActionCallOutput[];
  thinking: ResponseOutput[];
  responses: ResponseOutput[];
};

export type ActionCallPromptConfig = InferGeneratePromptConfig<
  typeof dataLoderPromptTemplate
>;

export async function generateActionCalls(
  opts: {
    runtime: IElizaRuntime;
  } & Pick<ActionCallPromptConfig, 'data' | 'variables'>
): Promise<ActionCallOutput[]> {
  return await generateOutput({
    debug: true,
    runtime: opts.runtime,
    prompt: {
      template: dataLoderPromptTemplate,
      variables: opts.variables,
      data: opts.data,
    },
    output: [] as ActionCallOutput[],
    visitors: {
      action: (output, node) => {
        try {
          output.push({
            name: node.attributes.name,
            params: JSON.parse(node.content),
          });
        } catch (error) {
          console.log({ output, node });
        }
      },
    },
  });
}

export type ChatHandlerPromptConfig = InferGeneratePromptConfig<
  typeof chatHandlerPromptTemplate
>;

export async function generateChatOutput({
  runtime,
  params,
  variables,
  data,
  debug,
}: {
  runtime: IElizaRuntime;
  debug?: boolean;
  params?: Partial<LLMParams>;
} & Pick<ChatHandlerPromptConfig, 'data' | 'variables'>): Promise<ChatOutput> {
  return await generateOutput({
    runtime,
    debug,
    prompt: {
      template: chatHandlerPromptTemplate,
      variables,
      data,
    },
    output: {
      thinking: [],
      calls: [],
      responses: [],
    } as ChatOutput,
    visitors: {
      action: (output, node) => {
        try {
          output.calls.push({
            name: node.attributes.name,
            params: JSON.parse(node.content),
          });
        } catch (error) {
          console.log({ output, node });
        }
      },
      thinking: (output, node) => {
        output.thinking.push({
          msgId: node.attributes.msgId,
          content: node.content,
        });
      },
      response: (output, node) => {
        output.responses.push({
          msgId: node.attributes.msgId,
          content: node.content,
        });
      },
    },
  });
}

export type ChatActionHandlerPromptConfig = InferGeneratePromptConfig<
  typeof chatActionHandlerPromptTemplate
>;

export async function generateActionResults({
  runtime,
  variables,
  data,
  debug,
}: {
  runtime: IElizaRuntime;
  debug?: boolean;
  params?: Partial<LLMParams>;
} & Pick<
  ChatActionHandlerPromptConfig,
  'data' | 'variables'
>): Promise<ChatOutput> {
  return await generateOutput({
    runtime,
    debug,
    prompt: {
      template: chatActionHandlerPromptTemplate,
      variables,
      data,
    },
    output: {
      thinking: [],
      calls: [],
      responses: [],
    } as ChatOutput,
    visitors: {
      action: (output, node) => {
        try {
          output.calls.push({
            name: node.attributes.name,
            params: JSON.parse(node.content),
          });
        } catch (error) {
          console.log({ output, node });
        }
      },
      thinking: (output, node) => {
        output.thinking.push({
          msgId: node.attributes.msgId,
          content: node.content,
        });
      },
      response: (output, node) => {
        output.responses.push({
          msgId: node.attributes.msgId,
          content: node.content,
        });
      },
    },
  });
}
