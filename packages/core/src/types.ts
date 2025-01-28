import { AnyPrompt, InferPromptVariables, Prompt } from './prompt';
import { ZodSchema, z } from 'zod';
import type { EventEmitter } from 'events';
import { AgentRuntime } from './base';

export type Pretty<type> = { [key in keyof type]: type[key] } & unknown;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Represents a UUID string in the format "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 */
export type UUID = `${string}-${string}-${string}-${string}-${string}`;

/**
 * Represents an actor/participant in a conversation
 */
export interface Actor {
  /** Unique identifier */
  id: UUID;

  /** Display name */
  name: string;

  /** Username/handle */
  username: string;
}

/**
 * Represents a stored memory/message
 */

export interface IMemory<
  TType extends string = string,
  TContent extends Record<string, any> = any,
  TMetadata extends Record<string, any> = any,
> {
  /** Optional unique identifier */
  id: UUID;

  // type: string;
  type: TType;

  /** Associated agent ID */
  agentId: UUID;

  /** Associated user ID */
  userId: UUID;

  /** Associated room ID */
  roomId: UUID;

  /** Optional creation timestamp */
  createdAt: number;

  /** IMemory content */
  content: TContent;

  /** Optional embedding vector */
  embedding?: number[];

  /** Whether memory is unique */
  unique?: boolean;

  /** Embedding similarity score */
  similarity?: number;

  metadata: TMetadata;
}

export type AnyMemory = IMemory<any, any, any>;

export type ActionParams<
  TParams extends ZodSchema<any> = ZodSchema<any>,
  TMemory extends AnyMemory = AnyMemory,
> =
  | TParams
  | (<TState = any>(
    runtime: IAgentRuntime,
    message: TMemory,
    state: TState
  ) => TParams);

export type InferActionParamsSchema<TActionParams extends ActionParams<any>> =
  TActionParams extends ActionParams<infer Params> ? Params : never;

/**
 * Validator function type for actions/evaluators
 */

export type ActionValidator<
  TState = any,
  TMemory extends IMemory = AnyMemory,
  TParams extends ActionParams = ActionParams,
  TAgentRuntime extends IAgentRuntime<TState> = IAgentRuntime<TState>,
> = (
  runtime: TAgentRuntime,
  message: TMemory,
  state: TState | undefined,
  params: z.infer<InferActionParamsSchema<TParams>>
) => Promise<boolean>;

type AnyAgentRuntime<TState = any> = IAgentRuntime<TState>;

/**
 * Handler function type for processing messages
 */
export type ActionHandler<
  TState = any,
  TMemory extends IMemory = AnyMemory,
  TResult = any,
  TParams extends ActionParams = ActionParams,
  TAgentRuntime extends AnyAgentRuntime<TState> = AnyAgentRuntime<TState>,
  HandlerCallback = any,
> = (
  runtime: TAgentRuntime,
  memory: TMemory,
  state: TState,
  params: z.infer<InferActionParamsSchema<TParams>>,
  callback?: HandlerCallback
) => Promise<TResult>;

/**
 * Represents an action the agent can perform
 */
export interface IAction<
  TState = any,
  TMemory extends IMemory = AnyMemory,
  TParams extends ActionParams = ActionParams,
  TResult = any,
  TAgentRuntime extends AnyAgentRuntime<TState> = any,
  HandlerCallback = any,
> {
  name: string;
  //   /** Similar action descriptions */
  //   similes: string[];

  /** Detailed description */
  description: string;

  parameters: TParams;

  enabled: boolean;

  /** Handler function */
  handler: ActionHandler<
    TState,
    TMemory,
    TResult,
    TParams,
    TAgentRuntime,
    HandlerCallback
  >;

  /** IAction name */

  /** Validation function */
  validate: ActionValidator<TState, TMemory, TParams, TAgentRuntime>;
}

/**
 * Represents a single objective within a goal
 */
export interface Objective {
  /** Optional unique identifier */
  id?: string;

  /** Description of what needs to be achieved */
  description: string;

  /** Whether objective is completed */
  completed: boolean;
}

/**
 * Status enum for goals
 */
export enum GoalStatus {
  DONE = 'DONE',
  FAILED = 'FAILED',
  IN_PROGRESS = 'IN_PROGRESS',
}

/**
 * Represents a high-level goal composed of objectives
 */
export interface Goal {
  /** Optional unique identifier */
  id?: UUID;

  /** Room ID where goal exists */
  roomId: UUID;

  /** User ID of goal owner */
  userId: UUID;

  /** Name/title of the goal */
  name: string;

  /** Current status */
  status: GoalStatus;

  /** Component objectives */
  objectives: Objective[];
}

/**
 * IProvider for external data/services
 */
export interface IProvider<
  TState = any,
  TMemory extends IMemory<any, any> = IMemory<any, any>,
> {
  /** Data retrieval function */
  get: (
    runtime: IAgentRuntime<TState>,
    memory: TMemory,
    state: TState
  ) => Promise<any>;
}

/**
 * Handler function type for processing messages
 */
export type EvaluatorHandler<
  TState = any,
  TMemory extends IMemory<any, any> = IMemory<any, any>,
  TResult = any,
  TAgentRuntime extends IAgentRuntime<TState> = IAgentRuntime<TState>,
  HandlerCallback = any,
> = (
  runtime: TAgentRuntime,
  message: TMemory,
  state: TState,
  callback: HandlerCallback
) => Promise<TResult>;

export type EvaluatorValidator<
  TState = any,
  TMemory extends IMemory<any, any> = IMemory<any, any>,
  TAgentRuntime extends IAgentRuntime<TState> = IAgentRuntime<TState>,
> = (
  runtime: TAgentRuntime,
  message: TMemory,
  state: TState
) => Promise<boolean>;

/**
 * IEvaluator for assessing agent responses
 */
export interface IEvaluator<
  TState = any,
  TMemory extends IMemory = AnyMemory,
  TResult = any,
  TAgentRuntime extends IAgentRuntime<TState> = any,
  HandlerCallback = any,
> {
  /** IEvaluator name */
  name: string;

  /** Detailed description */
  description: string;

  /** Whether to always run */
  alwaysRun?: boolean;

  /** Handler function */
  handler: EvaluatorHandler<
    TState,
    TMemory,
    TResult,
    TAgentRuntime,
    HandlerCallback
  >;

  /** Validation function */
  validate: EvaluatorValidator<TState, TMemory, TAgentRuntime>;
}

/**
 * Represents a relationship between users
 */
export interface Relationship {
  /** Unique identifier */
  id: UUID;

  /** First user ID */
  userA: UUID;

  /** Second user ID */
  userB: UUID;

  /** Primary user ID */
  userId: UUID;

  /** Associated room ID */
  roomId: UUID;

  /** Relationship status */
  status: string;

  /** Optional creation timestamp */
  createdAt?: string;
}

/**
 * Represents a user account
 */
export interface Account {
  /** Unique identifier */
  id: UUID;

  /** Display name */
  name: string;

  /** Username */
  username: string;
}

/**
 * Room participant with account details
 */
export interface Participant {
  /** Unique identifier */
  id: UUID;

  /** Associated account */
  account: Account;
}

/**
 * Represents a conversation room
 */
export interface Room {
  /** Unique identifier */
  id: UUID;

  //   /** Room participants */
  //   participants: Participant[];
}

/**
 * Client interface for platform connections
 */
export type Client<TMemory extends AnyMemory = AnyMemory> = {
  name: string;

  /** Start client connection */
  start: () => Promise<void>;

  /** Stop client connection */
  stop: () => Promise<void>;

  sendMessage(message: TMemory): Promise<TMemory>;
};

export interface Service {
  initialize(runtime: AnyAgentRuntime): Promise<void>;
}

/**
 * Plugin for extending agent functionality
 */
export type IPlugin<
  TState = any,
  TAction extends IAction<TState> = IAction<TState>,
  TProvider extends IProvider<TState> = IProvider<TState>,
  TEvaluator extends IEvaluator<TState> = IEvaluator<TState>,
> = {
  /** Plugin name */
  name: string;

  /** Plugin description */
  description: string;

  /** Optional actions */
  actions?: TAction[];

  /** Optional providers */
  providers?: TProvider[];

  /** Optional evaluators */
  evaluators?: TEvaluator[];

  /** Optional inventory providers */
  inventoryProviders?: InventoryProvider[];

  /** Optional services */
  services?: Service[];

  /** Optional clients */
  clients?: Client[];
};

/**
 * Interface for database operations
 */
export interface IDatabaseAdapter<DB = unknown> {
  /**
   * The database instance.
   */
  db: DB;

  /** Optional initialization */
  init(): Promise<void>;

  /** Close database connection */
  close(): Promise<void>;
  /**
   * Retrieves an account by its ID.
   * @param userId The UUID of the user account to retrieve.
   * @returns A Promise that resolves to the Account object or null if not found.
   */
  getAccountById(userId: UUID): Promise<Account | null>;

  /**
   * Creates a new account in the database.
   * @param account The account object to create.
   * @returns A Promise that resolves when the account creation is complete.
   */
  createAccount(account: Account): Promise<boolean>;

  /**
   * Retrieves memories based on the specified parameters.
   * @param params An object containing parameters for the memory retrieval.
   * @returns A Promise that resolves to an array of IMemory objects.
   */
  getMemories<
    TType extends string = string,
    TContent extends Record<string, any> = any,
    TMemory extends IMemory<TType, TContent> = IMemory<TType, TContent>,
  >(params: {
    agentId: UUID;
    roomId: UUID;
    count?: number;
    unique?: boolean;
    tableName: string;
    start?: number;
    end?: number;
  }): Promise<TMemory[]>;

  getMemoriesByRoomIds<
    TMemory extends IMemory<any, any> = IMemory<any, any>,
  >(params: {
    agentId: UUID;
    roomIds: UUID[];
    tableName: string;
  }): Promise<TMemory[]>;

  getMemoryById<TMemory extends IMemory<any, any> = IMemory<any, any>>(
    id: UUID
  ): Promise<TMemory | null>;

  /**
   * Retrieves cached embeddings based on the specified query parameters.
   * @param params An object containing parameters for the embedding retrieval.
   * @returns A Promise that resolves to an array of objects containing embeddings and levenshtein scores.
   */
  getCachedEmbeddings({
    query_table_name,
    query_threshold,
    query_input,
    query_field_name,
    query_field_sub_name,
    query_match_count,
  }: {
    query_table_name: string;
    query_threshold: number;
    query_input: string;
    query_field_name: string;
    query_field_sub_name: string;
    query_match_count: number;
  }): Promise<
    {
      embedding: number[];
      levenshtein_score: number;
    }[]
  >;

  /**
   * Logs an event or action with the specified details.
   * @param params An object containing parameters for the log entry.
   * @returns A Promise that resolves when the log entry has been saved.
   */
  log(params: {
    body: { [key: string]: unknown };
    userId: UUID;
    roomId: UUID;
    type: string;
  }): Promise<void>;

  /**
   * Retrieves details of actors in a given room.
   * @param params An object containing the roomId to search for actors.
   * @returns A Promise that resolves to an array of Actor objects.
   */
  getActorDetails(params: { roomId: UUID }): Promise<Actor[]>;

  /**
   * Searches for memories based on embeddings and other specified parameters.
   * @param params An object containing parameters for the memory search.
   * @returns A Promise that resolves to an array of IMemory objects.
   */
  searchMemories<
    TType extends string = string,
    TContent extends Record<string, any> = any,
    TMemory extends IMemory<TType, TContent> = IMemory<TType, TContent>,
  >(params: {
    tableName: TType;
    agentId: UUID;
    roomId: UUID;
    embedding: number[];
    match_threshold: number;
    match_count: number;
    unique: boolean;
  }): Promise<TMemory[]>;

  /**
   * Updates the status of a specific goal.
   * @param params An object containing the goalId and the new status.
   * @returns A Promise that resolves when the goal status has been updated.
   */
  updateGoalStatus(params: { goalId: UUID; status: GoalStatus }): Promise<void>;

  /**
   * Searches for memories by embedding and other specified parameters.
   * @param embedding The embedding vector to search with.
   * @param params Additional parameters for the search.
   * @returns A Promise that resolves to an array of IMemory objects.
   */
  searchMemoriesByEmbedding<
    TType extends string = string,
    TContent extends Record<string, any> = any,
  >(
    embedding: number[],
    params: {
      match_threshold?: number;
      count?: number;
      roomId?: UUID;
      agentId?: UUID;
      unique?: boolean;
      tableName: TType;
    }
  ): Promise<IMemory<TType, TContent>[]>;

  /**
   * Creates a new memory in the database.
   * @param memory The memory object to create.
   * @param tableName The table where the memory should be stored.
   * @param unique Indicates if the memory should be unique.
   * @returns A Promise that resolves when the memory has been created.
   */
  createMemory(
    memory: IMemory,
    tableName: string,
    unique?: boolean
  ): Promise<void>;

  /**
   * Removes a specific memory from the database.
   * @param memoryId The UUID of the memory to remove.
   * @param tableName The table from which the memory should be removed.
   * @returns A Promise that resolves when the memory has been removed.
   */
  removeMemory(memoryId: UUID, tableName: string): Promise<void>;

  /**
   * Removes all memories associated with a specific room.
   * @param roomId The UUID of the room whose memories should be removed.
   * @param tableName The table from which the memories should be removed.
   * @returns A Promise that resolves when all memories have been removed.
   */
  removeAllMemories(roomId: UUID, tableName: string): Promise<void>;

  /**
   * Counts the number of memories in a specific room.
   * @param roomId The UUID of the room for which to count memories.
   * @param unique Specifies whether to count only unique memories.
   * @param tableName Optional table name to count memories from.
   * @returns A Promise that resolves to the number of memories.
   */
  countMemories(
    roomId: UUID,
    unique?: boolean,
    tableName?: string
  ): Promise<number>;

  /**
   * Retrieves goals based on specified parameters.
   * @param params An object containing parameters for goal retrieval.
   * @returns A Promise that resolves to an array of Goal objects.
   */
  getGoals(params: {
    agentId: UUID;
    roomId: UUID;
    userId?: UUID | null;
    onlyInProgress?: boolean;
    count?: number;
  }): Promise<Goal[]>;

  /**
   * Updates a specific goal in the database.
   * @param goal The goal object with updated properties.
   * @returns A Promise that resolves when the goal has been updated.
   */
  updateGoal(goal: Goal): Promise<void>;

  /**
   * Creates a new goal in the database.
   * @param goal The goal object to create.
   * @returns A Promise that resolves when the goal has been created.
   */
  createGoal(goal: Goal): Promise<void>;

  /**
   * Removes a specific goal from the database.
   * @param goalId The UUID of the goal to remove.
   * @returns A Promise that resolves when the goal has been removed.
   */
  removeGoal(goalId: UUID): Promise<void>;

  /**
   * Removes all goals associated with a specific room.
   * @param roomId The UUID of the room whose goals should be removed.
   * @returns A Promise that resolves when all goals have been removed.
   */
  removeAllGoals(roomId: UUID): Promise<void>;

  /**
   * Retrieves the room ID for a given room, if it exists.
   * @param roomId The UUID of the room to retrieve.
   * @returns A Promise that resolves to the room ID or null if not found.
   */
  getRoom(roomId: UUID): Promise<UUID | null>;

  /**
   * Creates a new room with an optional specified ID.
   * @param roomId Optional UUID to assign to the new room.
   * @returns A Promise that resolves to the UUID of the created room.
   */
  createRoom(roomId?: UUID): Promise<UUID>;

  /**
   * Removes a specific room from the database.
   * @param roomId The UUID of the room to remove.
   * @returns A Promise that resolves when the room has been removed.
   */
  removeRoom(roomId: UUID): Promise<void>;

  /**
   * Retrieves room IDs for which a specific user is a participant.
   * @param userId The UUID of the user.
   * @returns A Promise that resolves to an array of room IDs.
   */
  getRoomsForParticipant(userId: UUID): Promise<UUID[]>;

  /**
   * Retrieves room IDs for which specific users are participants.
   * @param userIds An array of UUIDs of the users.
   * @returns A Promise that resolves to an array of room IDs.
   */
  getRoomsForParticipants(userIds: UUID[]): Promise<UUID[]>;

  /**
   * Adds a user as a participant to a specific room.
   * @param userId The UUID of the user to add as a participant.
   * @param roomId The UUID of the room to which the user will be added.
   * @returns A Promise that resolves to a boolean indicating success or failure.
   */
  addParticipant(userId: UUID, roomId: UUID): Promise<boolean>;

  /**
   * Removes a user as a participant from a specific room.
   * @param userId The UUID of the user to remove as a participant.
   * @param roomId The UUID of the room from which the user will be removed.
   * @returns A Promise that resolves to a boolean indicating success or failure.
   */
  removeParticipant(userId: UUID, roomId: UUID): Promise<boolean>;

  /**
   * Retrieves participants associated with a specific account.
   * @param userId The UUID of the account.
   * @returns A Promise that resolves to an array of Participant objects.
   */
  getParticipantsForAccount(userId: UUID): Promise<Participant[]>;

  /**
   * Retrieves participants associated with a specific account.
   * @param userId The UUID of the account.
   * @returns A Promise that resolves to an array of Participant objects.
   */
  getParticipantsForAccount(userId: UUID): Promise<Participant[]>;

  /**
   * Retrieves participants for a specific room.
   * @param roomId The UUID of the room for which to retrieve participants.
   * @returns A Promise that resolves to an array of UUIDs representing the participants.
   */
  getParticipantsForRoom(roomId: UUID): Promise<UUID[]>;

  getParticipantUserState(
    roomId: UUID,
    userId: UUID
  ): Promise<'FOLLOWED' | 'MUTED' | null>;
  setParticipantUserState(
    roomId: UUID,
    userId: UUID,
    state: 'FOLLOWED' | 'MUTED' | null
  ): Promise<void>;

  /**
   * Creates a new relationship between two users.
   * @param params An object containing the UUIDs of the two users (userA and userB).
   * @returns A Promise that resolves to a boolean indicating success or failure of the creation.
   */
  createRelationship(params: { userA: UUID; userB: UUID }): Promise<boolean>;

  /**
   * Retrieves a relationship between two users if it exists.
   * @param params An object containing the UUIDs of the two users (userA and userB).
   * @returns A Promise that resolves to the Relationship object or null if not found.
   */
  getRelationship(params: {
    userA: UUID;
    userB: UUID;
  }): Promise<Relationship | null>;

  /**
   * Retrieves all relationships for a specific user.
   * @param params An object containing the UUID of the user.
   * @returns A Promise that resolves to an array of Relationship objects.
   */

  getRelationships(params: { userId: UUID }): Promise<Relationship[]>;
}

export interface IDatabaseCacheAdapter {
  getCache(params: { agentId: UUID; key: string }): Promise<string | undefined>;

  setCache(params: {
    agentId: UUID;
    key: string;
    value: string;
  }): Promise<boolean>;

  deleteCache(params: { agentId: UUID; key: string }): Promise<boolean>;
}

// type DefaultEventMap = [never];

type EventMap<T = any> =
  T extends Record<infer Key, any[]> ? Record<Key, T[Key]> : Record<any, any[]>;

export type MemoryManagerEventMap<
  TType extends string = string,
  TContent extends Record<string, any> = any,
  TMemory extends IMemory<TType, TContent> = IMemory<TType, TContent>,
  T extends Record<string, any[]> = Record<string, any[]>,
> = EventMap<
  {
    'memory:created': [
      {
        type?: TType;
        memory: TMemory;
      },
    ];
  } & T
>;

export type MemoryCreateData<TMemory extends Memory> = Omit<
  Optional<TMemory, 'id' | 'metadata' | 'embedding'>,
  'agentId' | 'type'
>;

export interface IMemoryManager<
  TMemory extends IMemory<any, any> = IMemory<any, any>,
// TEventMap extends T,
> extends EventEmitter<
  MemoryManagerEventMap<TMemory['type'], TMemory['content'], TMemory>
> {
  runtime: IAgentRuntime<any>;
  tableName: TMemory['type'];

  addEmbeddingToMemory(memory: TMemory): Promise<TMemory>;

  getMemories(opts: {
    roomId: UUID;
    count?: number;
    unique?: boolean;
    start?: number;
    end?: number;
  }): Promise<TMemory[]>;

  getCachedEmbeddings(
    content: string
  ): Promise<{ embedding: number[]; levenshtein_score: number }[]>;

  getMemoryById(id: UUID): Promise<TMemory | null>;

  getMemoriesByRoomIds(params: { roomIds: UUID[] }): Promise<TMemory[]>;

  searchMemoriesByEmbedding(
    embedding: number[],
    opts: {
      match_threshold?: number;
      count?: number;
      roomId: UUID;
      unique?: boolean;
    }
  ): Promise<TMemory[]>;

  createMemory(
    memory: MemoryCreateData<TMemory>,
    unique?: boolean
  ): Promise<TMemory>;

  removeMemory(memoryId: UUID): Promise<void>;

  removeAllMemories(roomId: UUID): Promise<void>;

  countMemories(roomId: UUID, unique?: boolean): Promise<number>;
}

export type CacheOptions = {
  expires?: number;
};

export interface ICacheManager {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface MemoryRegistry extends Record<string, IMemory> {
  messages: AnyMemory;
  actions: AnyMemory;
}

// type ParseEventName =

type EventName = `${string}::${string}`;

export type EventParams<T = any> = T;

export interface EventRegistry extends Record<string, EventParams> { }

export interface MemoryRegistry extends Record<string, IMemory> {
  messages: AnyMemory;
  actions: AnyMemory;
}

export interface AgentRegistry {
  events: EventRegistry;
  memory: MemoryRegistry;
}

export type ICharacter = {
  name: string;
  username: string;
};

export type EventListener<EventParams = any> = (params: EventParams) => void;

export type EventSubscriber = () => void;

export type FunctionHandler<
  Params = any,
  ReturnType = any,
  TAgentRuntime extends IAgentRuntime = AnyAgentRuntime,
> = (runtime: TAgentRuntime, params: Params) => Promise<ReturnType>;

export type IFunction<
  Name = any,
  Params = any,
  ReturnType = any,
  TAgentRuntime extends IAgentRuntime = AnyAgentRuntime,
> = {
  name: Name;
  handler: FunctionHandler<Params, ReturnType, TAgentRuntime>;
};

export type AnyFunction = IFunction<any, any, any, any>;

export type InferFunctionParams<TFunction extends AnyFunction> =
  TFunction extends IFunction<any, infer Params, any, any> ? Params : any;

export type InferFunctionReturnType<TFunction extends AnyFunction> =
  TFunction extends IFunction<any, any, infer ReturnType, any>
  ? ReturnType
  : any;

export interface IAgentRuntime<
  TState = any,
  TCharacter extends ICharacter = ICharacter,
  //   TEval = any,
  IMemoryRegistry extends MemoryRegistry = MemoryRegistry,
  TEventRegistry extends EventRegistry = EventRegistry,
  // TFunctionRegistry extends Record<string, AnyFunction> = Record<
  //   string,
  //   AnyFunction
  // >,
  TAction extends IAction<TState> = IAction<TState>,
  TProvider extends IProvider<TState> = IProvider<TState>,
  TEvaluator extends IEvaluator<TState> = IEvaluator<TState>,
  TPlugin extends IPlugin<TState> = IPlugin<
    TState,
    TAction,
    TProvider,
    TEvaluator
  >,
> {
  // Properties
  agentId: UUID;

  db: IDatabaseAdapter;
  cache: ICacheManager;
  files: IFileManager;

  character: TCharacter;

  providers: TProvider[];
  actions: TAction[];
  evaluators: TEvaluator[];

  inventory: InventoryProvider[]

  plugins: TPlugin[];
  clients: Map<string, Client>;

  services: Map<string, Service>;
  memoryManagers: Map<string, IMemoryManager>;

  listeners: Map<string, Set<EventListener<any>>>;

  functions: Map<string, AnyFunction>;

  initialize(): Promise<void>;

  registerMemoryManager(manager: IMemoryManager): void;

  getMemoryManager(name: string): IMemoryManager;

  getService<TService extends Service>(service: string): TService;

  registerService(name: string, service: Service): void;

  registerPlugin(plugin: TPlugin): void;

  registerClient(client: Client): void;

  registerAction(action: TAction): void;

  registerEvaluator(evaluator: TEvaluator): void;

  registerContextProvider(provider: TProvider): void;

  on<Event extends keyof TEventRegistry>(
    event: Event,
    listener: EventListener<TEventRegistry[Event]>
  ): EventSubscriber;

  emit<
    Event extends keyof TEventRegistry,
    Params extends TEventRegistry[Event],
  >(
    event: Event,
    params: Params
  ): void;

  registerFunction<TFunction extends AnyFunction>(Function: TFunction): void;

  // call<TFunction extends AnyFunction>(
  //   name: TFunction['name'],
  //   params: InferFunctionParams<TFunction>
  // ): Promise<InferFunctionReturnType<TFunction>>;

  getSetting<T = string>(key: string): T;

  processActions(
    message: IMemoryRegistry['messages'],
    actions: IMemoryRegistry['actions'][],
    state: TState
    // callback?: HandlerCallback
  ): Promise<TState>;

  evaluate(
    message: IMemoryRegistry['messages'],
    state: TState,
    didRespond?: boolean
  ): Promise<any>;

  ensureParticipantExists(userId: UUID, roomId: UUID): Promise<void>;

  ensureUserExists(
    userId: UUID,
    userName: string | null,
    name: string | null,
    source: string | null
  ): Promise<void>;

  registerAction(action: TAction): void;

  ensureConnection(
    userId: UUID,
    roomId: UUID,
    userName?: string,
    userScreenName?: string,
    source?: string
  ): Promise<void>;

  ensureParticipantInRoom(userId: UUID, roomId: UUID): Promise<void>;

  ensureRoomExists(roomId: UUID): Promise<void>;

  composeState(message: IMemoryRegistry['messages']): Promise<TState>;

  composeState<ExtendedState>(
    message: IMemoryRegistry['messages'],
    customState: ExtendedState
  ): Promise<TState & ExtendedState>;

  updateRecentMessageState<RState extends TState = TState>(
    state: RState
  ): Promise<RState>;
}

export interface IFileManager {
  read(file: string): Promise<string>;
  readBytes(file: string): Promise<Buffer>;

  write(file: string, data: string): Promise<void>;
  writeBytes(file: string, data: Buffer): Promise<void>;

  exists(file: string): Promise<boolean>;

  ls(path: string): Promise<{ filename: string }[]>;
}

/**
 * Represents a media attachment
 */
export type Media = {
  /** Unique identifier */
  id: string;

  /** Media URL */
  url: string;

  /** Media title */
  title: string;

  /** Media source */
  source: string;

  /** Media description */
  description: string;

  /** Text content */
  text: string;

  /** Content type */
  contentType?: string;
};

/**
 * Represents the content of a message or communication
 */
export interface MessageContent {
  /** The main text content */
  text: string;

  /** Optional action associated with the message */
  action?: string;

  /** Optional source/origin of the content */
  source?: string;

  /** URL of the original message/post (e.g. tweet URL, Discord message link) */
  url?: string;

  /** UUID of parent message if this is a reply/thread */
  inReplyTo?: UUID;

  /** Array of media attachments */
  attachments?: Media[];

  /** Additional dynamic properties */
  [key: string]: unknown;
}

export type ClientMetadata = {
  name: string;
  chatId: any;
  userId: any;
  msgId: any;
  data: any;
};

export type MemoryMetadata = {
  client?: ClientMetadata;
};

export type Memory<
  TType extends string = string,
  TContent extends Record<string, any> = any,
  TMetadata extends MemoryMetadata = MemoryMetadata,
> = IMemory<TType, TContent, TMetadata>;

export type Message = Memory<'messages', MessageContent>;

export type ActionCall = {
  type: 'call';
  name: string;
  msgId?: UUID;
  params: any;
};

export type ActionResult = {
  type: 'result';
  name: string;
  msgId?: UUID;
  callId: UUID;
  params: any;
  result: any;
};

export type ActionCallMemory = Memory<'actions', ActionCall>;
export type ActionResultMemory = Memory<'actions', ActionResult>;
export type ActionMemory = Memory<'actions', ActionCall | ActionResult>;

export type Thought = Memory<'thoughts', { msgId: string; text: string }>;

/**
 * Represents the current state/context of a conversation
 */
export interface State {
  /** ID of agent in conversation */
  agent: Actor;
  room: Room;
  messages: Message[];
  actors: Actor[];
  inventory: InventoryProvider[];
  actions: {
    calls: Map<UUID, ActionCallMemory>;
    results: Map<UUID, ActionResultMemory>;
    processing: Set<UUID>;
  };
  thoughts: Thought[];

  // // llm actions all the contexts already included (character, etc)
  // ask(); // do you wish to confirm x?

  // shouldRespond?();

  // think(smt: any): Promise<Thought>;
  // decide(actions: Action[]): Promise<ActionCall[]>;

  // // user actions

  // inventory(): Promise<Inventory>;
  // createMessage(): Promise<Message>;

  // execute(actions: ActionCall[]): Promise<ActionResult[]>;

  // // custom memory used to saved custom states, like shopping carts, etc
  // compose<T>(key: string, moreState: T);
  // get<T>(key: string): T;
}

export interface ElizaMemoryRegistry extends Record<string, Memory> {
  messages: Message;
  actions: ActionMemory;
  thoughts: Thought;
}

export type CreateMemoryManagersConfig<
  TMemoryRegistry extends Record<string, Memory>,
> = {
    [Key in keyof TMemoryRegistry]: IMemoryManager<TMemoryRegistry[Key]>;
  };

// TODO;
export type ActionHandlerCallback = () => void;

export type Function<
  Name = string,
  Params = any,
  ReturnType = any,
  TElizaRegistry extends ElizaRegistry = ElizaRegistry,
> = IFunction<Name, Params, ReturnType, IElizaRuntime<TElizaRegistry>>;

export type GenerateTextParams = {
  model: 'SMALL' | 'MEDIUM' | 'LARGE';
  system: string;
  prompt?: string;
  stop?: string[];
};

export type GenerateTextFunction = Function<
  'generate::text',
  GenerateTextParams,
  string
>;

export interface FunctionRegistry extends Record<any, Function> {
  'generate::text': GenerateTextFunction;
}

export interface ElizaRegistry extends Record<string, any> {
  // memories: any;
  // events: any;
  // functions: any;
}

export interface IElizaRuntime<
  TElizaRegistry extends ElizaRegistry = ElizaRegistry,
> extends IAgentRuntime<
  State,
  ICharacter,
  TElizaRegistry['memories'],
  TElizaRegistry['events'],
  Action,
  Provider,
  Evaluator
> {
  memories: CreateMemoryManagersConfig<ElizaMemoryRegistry>;
  contexts: Map<string, Context>;

  call<
    Name extends
    keyof TElizaRegistry['functions'] = keyof TElizaRegistry['functions'],
    TFunction extends
    TElizaRegistry['functions'][Name] = TElizaRegistry['functions'][Name],
  >(
    name: Name,
    params: InferFunctionParams<TFunction>
  ): Promise<InferFunctionReturnType<TFunction>>;
}

export type Provider = IProvider<State, Message>;

export type Action<
  TParams extends ActionParams = ActionParams,
  TResult = any,
> = IAction<
  State,
  Message,
  TParams,
  TResult,
  IElizaRuntime,
  ActionHandlerCallback
>;

// TODO;
export type EvaluatorHandlerCallback = () => void;

export type Evaluator<TResult = any> = IEvaluator<
  State,
  Message,
  TResult,
  IElizaRuntime,
  EvaluatorHandlerCallback
>;

export type Plugin = IPlugin<State, Action, Provider, Evaluator>;

export interface RuntimeData extends Record<string, any> {
  runtime: IElizaRuntime;
  message: Message;
  state: State;
  actors: Map<UUID, Actor>
};

export type Context<
  TPrompt extends AnyPrompt = AnyPrompt> = {
    name: string;
    description: string;

    content: TPrompt;
    prepare?: (props: RuntimeData) => Promise<InferPromptVariables<TPrompt>>
    plugins?: Plugin[];
    services?: Service[];
    providers?: Provider[];
    evaluators?: Evaluator[];
    actions?: Action[];
  };

// Inventory

export type InventoryItem = {
  name: string
  ticker: string
  address: string
  description: string
  quantity: number
}

export type InventoryAction = {
  name: string
  description: string
  parameters: any
  handler: (runtime: IAgentRuntime<any, any, any, any, any, any>, params: any, callback?: ActionHandlerCallback) => Promise<any>;
}

export type InventoryProvider = {
  name: string
  description: string
  items: InventoryItem[]
  actions: InventoryAction[]
}
// WIP
export type ClientHandler = (
  client: Client,
  roomId: UUID,
  user: Account,
  text: string,
  metadata: MemoryMetadata
) => Promise<void>;
