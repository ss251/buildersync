import { v5 as uuidv5 } from 'uuid';
import type {
  ActionCallMemory,
  ActionMemory,
  ActionResultMemory,
  AnyMemory,
  Function,
  Message,
  UUID,
  Action,
  ActionParams,
  Optional,
  Plugin,
  Context
} from './types';
import { AnyPrompt, } from "./prompt"
import { z, ZodSchema } from 'zod';

export const ELIZA_UUID = '0dcfeefe-1d6c-45f0-b6be-b91524b650f4';

export function stringToUuid(inputString: string): UUID {
  return uuidv5(inputString, ELIZA_UUID) as UUID;
}

export function isMessageMemory(memory: AnyMemory): memory is Message {
  return memory.type === 'messages';
}

export function isActionCall(memory: ActionMemory): memory is ActionCallMemory {
  return memory.content.type === 'call';
}

export function isActionResult(
  memory: ActionMemory
): memory is ActionResultMemory {
  return memory.content.type === 'result';
}

export function createFunction<
  const TFunction extends Function = Function,
// TElizaRegistry extends ElizaRegistry = ElizaRegistry,
>(fn: TFunction): TFunction {
  return fn;
}

export function createAction<
  TParams extends ActionParams<ZodSchema<any>, Message> = ActionParams<
    never,
    Message
  >,
  TResult = any,
>(
  action: Optional<
    Action<TParams, TResult>,
    'validate' | 'enabled' | 'description' | 'parameters'
  >
): Action<TParams, TResult> {
  return {
    ...action,
    enabled: action.enabled ?? true,
    validate: action.validate ?? (() => Promise.resolve(true)),
    description: action.description ?? '',
    parameters: action.parameters ?? (z.any() as any),
  };
}

export function createPlugin(plugin: Plugin): Plugin {
  return plugin;
}

export function createContext<
  TPrompt extends AnyPrompt = AnyPrompt,
  TContext extends Context<TPrompt> = Context<TPrompt>>(context: TContext): TContext {
  return context;
}
