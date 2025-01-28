import {
  Action, ActionCallMemory,
  ActionResultMemory, Actor, IElizaRuntime,
  Message, State, Thought
} from '@elizaos/core';
import { UUID } from 'crypto';
import { toHex } from 'viem';
import zodToJsonSchema from 'zod-to-json-schema';

type ActionFormatterData = {
  runtime: IElizaRuntime;
  message: Message;
  state: State;
};

function formatUUID(id: UUID) {
  return toHex(id).slice(0, 8);
}

export function formatAction<TAction extends Action<any, any>>(
  action: TAction,
  { runtime, message, state }: ActionFormatterData
) {
  const params =
    typeof action.parameters === 'function'
      ? action.parameters(runtime, message, state)
      : action.parameters;

  return {
    name: action.name,
    description: action.description,
    params: zodToJsonSchema(params),
  };
}

export function formatActionCall(call: ActionCallMemory) {
  return {
    callId: formatUUID(call.id),
    name: call.content.name,
    params: call.content.params,
    msgId: formatUUID(call.content.msgId!),
  };
}

export function formatActionResult(call: ActionResultMemory) {
  return {
    callId: formatUUID(call.id),
    name: call.content.name,
    params: call.content.params,
    result: call.content.result,
    msgId: formatUUID(call.content.msgId!),
  };
}

export function formatContext(c: { name: string, content: string }) {
  return `<context name="${c.name}">${c.content}</context>`;
}

export function formatContextDetails(c: { name: string, description: string }) {
  return `<context name="${c.name}">${c.description}</context>`;
}

export function formatMsg(actor: Actor, msg: Message) {
  return `<msg id="${formatUUID(msg.id)}" user="${actor.username}" time="${msg.createdAt}">${msg.content.text}</msg>`;
}

export function formatThought(t: Thought) {
  return `<thought msgId="${toHex(t.content.msgId).slice(0, 8)}">${t.content.text}</thougth>`;
}
