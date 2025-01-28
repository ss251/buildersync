import {
  Account,
  UUID,
  Action,
  Actor,
  Context,
  ActionCallMemory,
  Client,
  MemoryMetadata,
  Message,
  IElizaRuntime,
} from '../../core/src/types';
import { contextLoderPromptTemplate } from '../../core/src/prompts';
import {
  generateOutput,
  LLMParams,
  generateActionCalls,
  generateChatOutput,
  ActionCallOutput,
  generateActionResults,
} from '../../core/src/generate';
import { createFunction } from '../../core/src/utils';

export async function handleRoomMessage(
  runtime: IElizaRuntime,
  client: Client,
  system: Context[],
  roomId: UUID,
  user: Account,
  text: string,
  metadata?: MemoryMetadata,
  params?: Partial<LLMParams>
) {
  await runtime.ensureConnection(user.id, roomId, user.username, user.name);

  const message = await runtime.memories.messages.createMemory({
    userId: user.id,
    roomId,
    content: {
      text,
    },
    createdAt: Date.now(),
    metadata,
  });

  try {

    const dataActions: Action<any, any>[] = [];
    let state = await runtime.composeState(message);

    let activeContexts = new Set<string>();
    let data: any[] = [];

    const actors = new Map<UUID, Actor>(
      state.actors.map((actor) => [actor.id, actor])
    );

    const contexts: Context[] = [];

    const contextActionCalls =
      contexts.length > 0
        ? await generateOutput({
          runtime,
          prompt: {
            template: contextLoderPromptTemplate,
            variables: {
              contexts,
              active: Array.from(activeContexts.keys()).map((key) => {
                return runtime.contexts.get(key)!;
              }),
              messages: state.messages,
            },
            data: {
              actors,
              message,
              runtime,
              state
            },
          },
          output: {
            load: [] as string[],
            unload: [] as string[],
          },
          visitors: {
            load: (state, node) => {
              state.load.push(node.attributes.name);
            },
            unload: (state, node) => {
              state.unload.push(node.attributes.name);
            },
          },
        })
        : [];

    const providerPromise: Promise<any>[] = [];

    for (const provider of runtime.providers) {
      providerPromise.push(provider.get(runtime, message, state));
    }

    await Promise.allSettled(providerPromise);

    // todo: include calls being proccess
    console.log({ contextActionCalls });

    const dataLoaderCalls =
      dataActions.length > 0
        ? await generateActionCalls({
          runtime,
          variables: {
            actions: dataActions,
            data,
            messages: state.messages,
          },
          data: {
            runtime,
            state,
            message,
            actors,
          },
        })
        : [];

    // todo: use process actions
    // include contexts, provider in call
    for (const call of dataLoaderCalls) {
      const action = dataActions.find((action) => action.name === call.name)!;

      const schema =
        typeof action.parameters === 'function'
          ? action.parameters(runtime, message, state)
          : action.parameters;

      const result = await action.handler(
        runtime,
        message,
        state,
        schema.parse(call.params)
      );

      data.push(result);
    }

    const preparedContexts = await Promise.all([
      ...system,
      ...Array.from(activeContexts).map(
        (name) => contexts.find((context) => context.name === name)!
      ),
    ].map(async c => {
      const vars = c.prepare ? await c.prepare({ state, actors, message, runtime }) : {};
      return {
        name: c.name,
        content: c.content.render(vars, { state, actors, message, runtime })
      }
    }))

    const { calls, thinking, responses } = await generateChatOutput({
      runtime,
      params,
      variables: {
        contexts: preparedContexts,
        actions: runtime.actions.filter((action) => action.enabled),
        conversation: state.messages.slice(1).reverse(),
        msg: state.messages[0],
        data,
      },
      data: {
        message,
        runtime,
        state,
        actors,
      },
    });

    console.log('Thinking: ', thinking[0]?.content);
    console.log('Response: ', responses[0]?.content);
    console.log('Calling: ', calls);

    await runtime.memories.thoughts.createMemory({
      userId: runtime.agentId,
      roomId,
      content: {
        msgId: message.id,
        text: thinking[0].content,
      },
      createdAt: Date.now(),
      metadata: message.metadata,
    });

    let response: Message | undefined = undefined;

    if (responses.length > 0) {
      response = await runtime.memories.messages.createMemory({
        userId: runtime.agentId,
        roomId,
        content: {
          text: responses.map((r) => r.content).join('\n'),
        },
        createdAt: Date.now(),
        metadata: {},
      });

      state = await runtime.updateRecentMessageState(state);
      response = await client.sendMessage(response);
    }

    const newActionCalls: ActionCallOutput[] = [...calls];
    const actionCallMemories: ActionCallMemory[] = [];

    let step = 0;
    const maxSteps = 3;

    while (newActionCalls.length > 0 && maxSteps > step) {
      for (const call of newActionCalls) {
        actionCallMemories.push(
          (await runtime.memories.actions.createMemory({
            userId: runtime.agentId,
            roomId,
            content: {
              type: 'call',
              msgId: message.id,
              name: call.name,
              params: call.params,
            },
            createdAt: Date.now(),
          })) as ActionCallMemory
        );
      }

      newActionCalls.length = 0;
      if (actionCallMemories.length === 0) break;

      // todo: handle errors/retries etc;
      state = await runtime.processActions(message, actionCallMemories, state);

      const results = Array.from(state.actions.results.values());

      const resultsResponse = await generateActionResults({
        runtime,
        params,
        variables: {
          contexts: preparedContexts,
          actions: runtime.actions,
          conversation: state.messages.slice(1).reverse(),
          msg: state.messages[0],
          data,
          calls: actionCallMemories,
          response,
          results,
          thinking: state.thoughts,
        },
        data: {
          message,
          runtime,
          state,
          actors,
        },
      });

      console.log('Thinking: ', resultsResponse.thinking[0]?.content);
      console.log('Response: ', resultsResponse.responses[0]?.content);
      console.log('Calling: ', resultsResponse.calls);

      await runtime.memories.thoughts.createMemory({
        userId: runtime.agentId,
        roomId,
        content: {
          msgId: message.id,
          text: resultsResponse.thinking[0].content,
        },
        createdAt: Date.now(),
      });

      if (resultsResponse.responses.length > 0) {
        const actionResponse = await runtime.memories.messages.createMemory({
          userId: runtime.agentId,
          roomId,
          content: {
            text: resultsResponse.responses.map((r) => r.content).join('\n'),
          },
          createdAt: Date.now(),
        });

        await client.sendMessage(actionResponse);
      }

      newActionCalls.push(...resultsResponse.calls);
      step++;
    }
  } catch (error) {
    console.error(error);
  }
}

export type ClientMessageHandlerParams = {
  client: string;
  system: Context[];
  roomId: UUID;
  user: Account;
  text: string;
  metadata?: MemoryMetadata;
};

export const handleClientMessage = createFunction({
  name: 'client::handleRoomMessage',
  handler: async (runtime, params: ClientMessageHandlerParams) => {
    const client = runtime.clients.get(params.client)!;
    const { system, user, roomId, text, metadata } = params;

    await handleRoomMessage(
      runtime,
      client,
      system,
      roomId,
      user,
      text,
      metadata
    );
  },
});
