import {
  Action,
  ActionCallMemory,
  ActionResultMemory,
  Context,
  Message,
  RuntimeData,
  Thought,
} from '../types';
import {
  formatAction,
  formatActionCall,
  formatActionResult,
  formatContext,
  formatContextDetails,
  formatMsg,
  formatThought,
} from '../../../runtime/src/formatters';
import { loadPrompt } from '../prompt';

import dataLoaderPrompt from "./data-loader.md"
import contextLoaderPrompt from "./context-loader.md"
import chatHandlerPrompt from "./chat-handler.md"
import chatActionHandlerPrompt from "./chat-action-handler.md"


export const dataLoderPromptTemplate = loadPrompt<
  {
    data: any;
    actions: Action[];
    messages: Message[];

  },
  {
    action: { name: string };
  },
  RuntimeData
>(dataLoaderPrompt, ({ data, actions, messages }, runtimeData) => ({
  data: data,
  actions: actions.map((action) => formatAction(action, runtimeData)),
  messages: messages.map((msg) => formatMsg(runtimeData.actors.get(msg.userId)!, msg)),
}));

export const contextLoderPromptTemplate = loadPrompt<
  // prompt variables types
  {
    contexts: Context[];
    active: Context[];
    messages: Message[];
  },
  // prompt outputs types
  {
    load: { name: string };
    unload: { name: string };
  },
  // prompt formatters data types
  RuntimeData
>(
  contextLoaderPrompt,
  ({ active, contexts, messages }, runtimeData) => ({
    active: active.map((c) => formatContextDetails(c)),
    contexts: contexts.map((c) => formatContextDetails(c)),
    messages: messages.map((msg) => formatMsg(runtimeData.actors.get(msg.userId)!, msg)),
  })
);



export const chatHandlerPromptTemplate = loadPrompt<
  // prompt variables types
  {
    contexts: { name: string, content: string }[];
    data: any[];
    actions: Action[];
    conversation: Message[];
    msg: Message;
  },
  // prompt outputs params
  {
    response: { msgId: string };
    action: { name: string };
    thinking: { msgId: string };
  },
  // prompt formatters injected data
  RuntimeData
>(
  chatHandlerPrompt,

  (
    { contexts, data, actions, conversation, msg },
    runtimeData
  ) => ({
    contexts: contexts.map((c) => formatContext(c)),
    data,
    actions: actions.map((a) => formatAction(a, runtimeData)),
    conversation: conversation.map((msg) =>
      formatMsg(runtimeData.actors.get(msg.userId)!, msg)
    ),
    msg: formatMsg(runtimeData.actors.get(msg.userId)!, msg),
  })

);

export const chatActionHandlerPromptTemplate = loadPrompt<
  // prompt variables types
  {
    contexts: { name: string, content: string }[];
    data: any[];
    actions: Action[];
    conversation: Message[];
    msg: Message;
    response: Message | undefined;
    thinking: Thought[];
    calls: ActionCallMemory[];
    results: ActionResultMemory[];
  },
  // prompt outputs params
  {
    response: { msgId: string };
    action: { name: string };
    thinking: { msgId: string };
  },
  // prompt formatters injected data
  RuntimeData
>(
  chatActionHandlerPrompt,
  (
    {
      contexts,
      data,
      actions,
      conversation,
      msg,
      calls,
      response,
      results,
      thinking,
    },
    runtimeData
  ) => ({
    contexts: contexts.map((c) => formatContext(c)),
    data,
    actions: actions.map((a) => formatAction(a, runtimeData)),
    conversation: conversation.map((msg) =>
      formatMsg(runtimeData.actors.get(msg.userId)!, msg)
    ),
    msg: formatMsg(runtimeData.actors.get(msg.userId)!, msg),
    response: response
      ? formatMsg(runtimeData.actors.get(response.userId)!, response)
      : 'No response yet',
    calls: calls.map((c) => formatActionCall(c)),
    results: results.map((r) => formatActionResult(r)),
    thinking: thinking.map((t) => formatThought(t)),
  })
);
