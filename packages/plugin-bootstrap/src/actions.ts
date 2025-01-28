import { createAction, http, UUID } from '@elizaos/core';
import { z } from 'zod';

export const getWeather = createAction({
  name: 'getWeather',
  description: 'Gets the weather',
  parameters: z.object({
    location: z.string().default('Lisbon'),
  }),

  async handler(runtime, memory, state, params, callback) {
    const geolocation = await http.get.json<{
      results: { latitude: number; longitude: number }[];
    }>('https://geocoding-api.open-meteo.com/v1/search', {
      name: params.location,
      count: 1,
      language: 'en',
      format: 'json',
    });

    const res = await http.get.json<{ test: true }>(
      'https://api.open-meteo.com/v1/forecast',
      {
        latitude: geolocation.results[0].latitude,
        longitude: geolocation.results[0].longitude,
        current_weather: 'true', // Request current weather data
      }
    );
    console.log({ weather: res });
    return res;
  },
});

export const sendClientMsg = createAction({
  name: 'sendClientMessage',
  description: 'Sends message to other clients',
  parameters: (runtime, message) =>
    z.object({
      client: z.enum(
        Array.from(runtime.clients.keys()).filter(
          (k) => k !== message.metadata.client?.name
        ) as [string, ...string[]]
      ),
      roomId: z.string().uuid(),
      msg: z.string(),
    }),

  async validate() {
    return true;
  },

  async handler(runtime, memory, state, params, callback) {
    const client = runtime.clients.get(params.client);

    if (!client) return 'No client';

    const msg = await runtime.memories.messages.createMemory({
      userId: runtime.agentId,
      content: {
        text: params.msg,
      },
      createdAt: Date.now(),
      roomId: params.roomId as UUID,
      metadata: {},
    });

    await client.sendMessage(msg);

    return 'Success';
  },
});

export const listFiles = createAction({
  name: 'fs.ls',
  description: 'ls',
  parameters: z.object({
    path: z.string().default('./'),
  }),
  async handler(runtime, memory, state, params, callback) {
    return await runtime.files.ls(params.path);
  },
});

export const readFile = createAction({
  name: 'fs.readFile',
  description: 'read a file',
  parameters: z.object({
    filepath: z.string().describe('The full filepath and filename'),
    content: z.string(),
  }),
  async handler(runtime, memory, state, params, callback) {
    return await runtime.files.read(params.filepath);
  },
});

export const writeFile = createAction({
  name: 'fs.writeFile',
  description: 'write to a file',
  parameters: z.object({
    filepath: z.string().describe('The full filepath and filename'),
    content: z.string(),
  }),
  async handler(runtime, memory, state, params, callback) {
    await runtime.files.write(params.filepath, params.content);
    return 'File written success';
  },
});

export const appendToFile = createAction({
  name: 'fs.appendToFile',
  description: 'append to a file',
  parameters: z.object({
    filepath: z.string().describe('The full filepath and filename'),
    content: z.string(),
  }),
  async handler(runtime, memory, state, params, callback) {
    const content = await runtime.files.read(params.filepath);
    await runtime.files.write(params.filepath, content + params.content);
    return 'File written success';
  },
});

export const fileActions = [listFiles, readFile, writeFile, appendToFile];
