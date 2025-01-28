import { UUID } from "crypto";
import { AgentRuntime, AgentRuntimeOptions } from "./base";
import {
  Action,
  ActionCallMemory,
  ActionMemory,
  Actor,
  Context,
  CreateMemoryManagersConfig,
  ElizaMemoryRegistry,
  ElizaRegistry,
  Evaluator,
  ICharacter,
  IElizaRuntime,
  InferFunctionParams,
  InferFunctionReturnType,
  InventoryProvider,
  Message,
  Plugin,
  Provider,
  State
} from './types';

import { isActionCall, isActionResult } from './utils';

export class ElizaRuntime<TElizaRegistry extends ElizaRegistry = ElizaRegistry>
  extends AgentRuntime<
    State,
    ICharacter,
    ElizaMemoryRegistry,
    TElizaRegistry['events'],
    Action,
    Provider,
    Evaluator,
    Plugin
  >
  implements IElizaRuntime<TElizaRegistry>
{
  memories: CreateMemoryManagersConfig<ElizaMemoryRegistry>;
  inventory: InventoryProvider[] = [];

  contexts: Map<string, Context>;

  constructor(opts: AgentRuntimeOptions) {
    super(opts);

    this.memories = {
      actions: this.createMemoryManager('actions'),
      messages: this.createMemoryManager('messages'),
      thoughts: this.createMemoryManager('thoughts'),
    };

    this.contexts = new Map();
  }

  async call<
    Name extends
      keyof TElizaRegistry['functions'] = keyof TElizaRegistry['functions'],
    TFunction extends
      TElizaRegistry['functions'][Name] = TElizaRegistry['functions'][Name],
  >(
    name: Name,
    params: InferFunctionParams<TFunction>
  ): Promise<InferFunctionReturnType<TFunction>> {
    console.log('calling', { name, params });
    const fn = this.functions.get(name as string);
    if (!fn) throw new Error('no handler');
    return await fn.handler(this, params);
  }

  // async call<TFunction extends AnyFunction = AnyFunction>(
  //   name: TFunction['name'],
  //   params: InferFunctionParams<TFunction>
  // ): Promise<InferFunctionReturnType<TFunction>> {
  //   this.functions.get(name as string)!;

  //   return {} as InferFunctionReturnType<InferFunctionReturnType<TFunction>>;
  // }

  async getRoomState(roomId: UUID) {
    const messages = await this.memories.messages.getMemories({
      roomId,
    });

    const calls = await this.memories.actions.getMemories({
      roomId,
    });

    const thoughts = await this.memories.thoughts.getMemories({
      roomId,
    });

    const actions: State['actions'] = {
      calls: new Map(),
      results: new Map(),
      processing: new Set(),
    };

    for (const call of calls) {
      if (isActionCall(call)) {
        actions.calls.set(call.id, call);
        actions.processing.add(call.id);
      }

      if (isActionResult(call)) {
        actions.processing.delete(call.content.callId);
        actions.results.set(call.id, call);
      }
    }

    return {
      messages,
      actions,
      thoughts,
    };
  }

  async composeState<ExtendedState = never>(
    message: Message,
    customState?: ExtendedState
  ) {
    const agent: Actor = {
      id: this.agentId,
      name: this.character.name,
      username: this.character.username,
    };

    const actors = await this.db.getActorDetails({ roomId: message.roomId });
    console.log({ actors });
    // const participants = await this.db.getParticipantsForRoom(message.roomId);
    // const user = await this.db.getAccountById(message.userId);

    const { messages, actions, thoughts } = await this.getRoomState(
      message.roomId
    );

    const state: State = {
      agent,
      actors,
      messages,
      actions,
      thoughts,
      inventory: this.inventory,
      room: {
        id: message.roomId,
        // participants: [],
      },
    };

    return customState
      ? {
          ...state,
          ...customState,
        }
      : state;
  }

  async updateRecentMessageState<RState extends State = State>(
    state: RState
  ): Promise<RState> {
    const updated = await this.getRoomState(state.room.id);

    return {
      ...state,
      ...updated,
    };
  }

  async evaluate(
    message: Message,
    state: State,
    didRespond?: boolean
  ): Promise<any> {
    // return true;
  }

  async processActions(
    message: Message,
    actions: ActionMemory[],
    state: State
  ): Promise<State> {
    const processing: Promise<any>[] = [];

    for (const call of actions) {
      if (!isActionCall(call)) continue;

      const action = this.actions.find(
        (action) => action.name === call.content.name
      );

      if (!action) {
        console.log({ missingAction: action });
        continue;
      }

      processing.push(this.processActionCall(state, message, action, call));
    }

    // todo: handle errors
    await Promise.allSettled(processing);

    return this.updateRecentMessageState(state);
  }

  private async processActionCall(
    state: State,
    message: Message,
    action: Action,
    call: ActionCallMemory
  ) {
    const schema =
      typeof action.parameters === 'function'
        ? action.parameters(this as any, message, state)
        : action.parameters;

    const params = schema.parse(call.content.params);

    const result = await action.handler(this as any, message, state, params);

    await this.memories.actions.createMemory({
      userId: this.agentId,
      roomId: state.room.id,
      content: {
        ...call.content,
        type: 'result',
        callId: call.id,
        result: result,
      },
      createdAt: Date.now(),
      metadata: message.metadata,
    });
  }
}
