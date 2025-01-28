import { MemoryManager } from './memory';
import {
  IAction,
  MemoryRegistry,
  Client,
  IEvaluator,
  IAgentRuntime,
  ICacheManager,
  IDatabaseAdapter,
  IMemoryManager,
  IMemory,
  Plugin,
  IProvider,
  Service,
  UUID,
  IFileManager,
  ICharacter,
  IPlugin,
  InventoryProvider,
  EventRegistry,
  FunctionRegistry,
  EventListener,
  EventSubscriber,
  Function,
  InferFunctionParams,
  InferFunctionReturnType,
  EventParams,
  CreateMemoryManagersConfig,
  AnyFunction,
  IFunction,
} from './types';

export type AgentRuntimeOptions<
  TState extends Record<string, any> = any,
  TCharacter extends ICharacter = ICharacter,
  TAction extends IAction<TState> = IAction<TState>,
  TProvider extends IProvider<TState> = IProvider<TState>,
  TEvaluator extends IEvaluator<TState> = IEvaluator<TState>,
  TPlugin extends IPlugin<TState, TAction, TProvider, TEvaluator> = IPlugin<
    TState,
    TAction,
    TProvider,
    TEvaluator
  >,
> = {
  agentId: UUID; // ID of the agent
  character: TCharacter; // The character to use for the agent
  actions?: TAction[]; // Optional custom actions
  evaluators?: TEvaluator[]; // Optional custom evaluators
  plugins?: TPlugin[];
  providers?: TProvider[];
  inventoryProviders?: InventoryProvider[];
  services?: Record<string, Service>; // Map of service name to service instance
  managers?: IMemoryManager[]; // Map of table name to memory manager
  db: IDatabaseAdapter; // The database adapter used for interacting with the database
  files: IFileManager;
  cache: ICacheManager;

  settings?: Record<string, any>;
};

/**
 * Represents the runtime environment for an agent, handling message processing,
 * action registration, and interaction with external services like OpenAI and Supabase.
 */
export abstract class AgentRuntime<
  TState extends Record<string, any> = any,
  TCharacter extends ICharacter = ICharacter,
  TMemoryRegistry extends MemoryRegistry = MemoryRegistry,
  TEventRegistry extends EventRegistry = EventRegistry,
  // TFunctionRegistry extends Record<string, AnyFunction> = Record<
  //   string,
  //   AnyFunction
  // >,
  TAction extends IAction<TState> = IAction<TState>,
  TProvider extends IProvider<TState> = IProvider<TState>,
  TEvaluator extends IEvaluator<TState> = IEvaluator<TState>,
  TPlugin extends IPlugin<TState, TAction, TProvider, TEvaluator> = IPlugin<
    TState,
    TAction,
    TProvider,
    TEvaluator
  >,
  TOptions extends AgentRuntimeOptions<
    TState,
    TCharacter,
    TAction,
    TProvider,
    TEvaluator,
    TPlugin
  > = AgentRuntimeOptions<
    TState,
    TCharacter,
    TAction,
    TProvider,
    TEvaluator,
    TPlugin
  >,
> implements
  IAgentRuntime<
    TState,
    TCharacter,
    // TEval,
    TMemoryRegistry,
    TEventRegistry,
    // TFunctionRegistry,
    TAction,
    TProvider,
    TEvaluator,
    TPlugin
  > {
  /**
   * The ID of the agent
   */
  agentId: UUID;

  /**
   * The database adapter used for interacting with the database.
   */
  db: IDatabaseAdapter;

  files: IFileManager;

  /**
   * Custom actions that the agent can perform.
   */
  actions: TAction[] = [];

  /**
   * Evaluators used to assess and guide the agent's responses.
   */
  evaluators: TEvaluator[] = [];

  /**
   * Context providers used to provide context for message generation.
   */
  providers: TProvider[] = [];

  plugins: TPlugin[] = [];

  clients: Map<string, Client>;

  inventory: InventoryProvider[] = [];

  /**
   * The character to use for the agent
   */
  character: TCharacter;

  services: Map<string, Service> = new Map();

  memoryManagers: Map<string, IMemoryManager> = new Map();

  cache: ICacheManager;

  settings: Record<string, any>;

  listeners: Map<string, Set<EventListener<any>>>;

  functions: Map<string, AnyFunction>;

  constructor(options: TOptions) {
    this.agentId = options.agentId;
    this.character = options.character;

    this.db = options.db;
    this.files = options.files;
    this.cache = options.cache;

    this.settings = options.settings ?? {};

    this.clients = new Map();

    this.functions = new Map();

    this.listeners = new Map();

    // this.memories = {
    //   messages: this.createMemoryManager('messages'),
    //   actions: this.createMemoryManager('calls'),
    // } as CreateMemoryManagersConfig<TMemoryRegistry>;

    options.managers?.forEach((manager) => {
      this.registerMemoryManager(manager);
    });

    for (const [name, service] of Object.entries(options.services ?? {})) {
      this.registerService(name, service);
    }

    options.plugins?.forEach((plugin) => {
      this.registerPlugin(plugin);
    });

    options.inventoryProviders?.forEach((provider) => {
      this.registerInventoryProvider(provider);
    });

    options.actions?.forEach((action) => {
      this.registerAction(action);
    });

    (options.providers ?? []).forEach((provider) => {
      this.registerContextProvider(provider);
    });

    (options.evaluators ?? []).forEach((evaluator) => {
      this.registerEvaluator(evaluator);
    });
  }

  abstract composeState(message: TMemoryRegistry['messages']): Promise<TState>;

  abstract composeState<ExtendedState = never>(
    message: TMemoryRegistry['messages'],
    customState: ExtendedState
  ): Promise<TState & ExtendedState>;

  abstract updateRecentMessageState<RState extends TState = TState>(
    state: RState
  ): Promise<RState>;

  abstract processActions(
    message: TMemoryRegistry['messages'],
    actions: TMemoryRegistry['actions'][],
    state: TState // callback?: HandlerCallback
  ): Promise<TState>;

  abstract evaluate(
    message: IMemory,
    state: TState,
    didRespond?: boolean
  ): Promise<any>;

  async initialize() {
    await this.db.init();

    await this.ensureRoomExists(this.agentId);
    await this.ensureUserExists(
      this.agentId,
      this.character.name,
      this.character.name
    );

    await this.ensureParticipantExists(this.agentId, this.agentId);

    for (const [serviceType, service] of this.services.entries()) {
      try {
        await service.initialize(this);
        this.services.set(serviceType, service);
        // logger.success(`Service ${serviceType} initialized successfully`);
      } catch (error) {
        // logger.error(
        //   `Failed to initialize service ${serviceType}:`,
        //   error
        // );
        throw error;
      }
    }

    await Promise.all(
      Array.from(this.clients.values()).map((client) => client.start())
    );
  }

  on<Event extends keyof TEventRegistry>(
    event: Event,
    listener: EventListener<TEventRegistry[Event]>
  ): EventSubscriber {
    const name = event as string;
    if (!this.listeners.has(name)) {
      this.listeners.set(name, new Set());
    }
    this.listeners.get(name)!.add(listener);
    return () => {
      this.listeners.get(name)!.delete(listener);
    };
  }

  emit<
    Event extends keyof TEventRegistry,
    Params extends TEventRegistry[Event],
  >(event: Event, params: Params): void {
    const listeners = this.listeners.get(event as string)?.values() ?? [];
    for (const listener of listeners) {
      listener(params);
    }
  }

  registerFunction<TFunction extends AnyFunction>(fn: TFunction): void {
    this.functions.set(fn.name, fn);
  }

  // abstract call<TFunction extends AnyFunction = AnyFunction>(
  //   name: TFunction['name'],
  //   params: InferFunctionParams<TFunction>
  // ): Promise<InferFunctionReturnType<TFunction>>;

  createMemoryManager<TMemory extends IMemory>(
    tableName: TMemory['type']
  ): IMemoryManager<TMemory> {
    const memoryManager = new MemoryManager<TMemory>({
      runtime: this,
      tableName,
    });

    this.registerMemoryManager(memoryManager);

    return memoryManager;
  }

  registerMemoryManager(manager: IMemoryManager): void {
    if (!manager.tableName) {
      throw new Error('IMemory manager must have a tableName');
    }

    if (this.memoryManagers.has(manager.tableName)) {
      //   logger.warn(
      //     `IMemory manager ${manager.tableName} is already registered. Skipping registration.`
      //   );
      return;
    }

    this.memoryManagers.set(manager.tableName, manager);
  }

  getMemoryManager(tableName: string): IMemoryManager {
    return this.memoryManagers.get(tableName)!;
  }

  getService<TService extends Service>(service: string): TService {
    const serviceInstance = this.services.get(service);
    return serviceInstance as TService;
  }

  registerService(name: string, service: Service): void {
    console.log('Registering service:', name);
    this.services.set(name, service);
    console.log(`Service ${name} registered successfully`);
  }

  registerInventoryProvider(provider: InventoryProvider): void {
    this.inventory.push(provider);
  }

  registerClient(client: Client): void {
    this.clients.set(client.name, client);
  }

  registerPlugin(plugin: TPlugin): void {
    this.plugins.push(plugin);

    plugin.actions?.forEach((action) => {
      this.registerAction(action);
    });

    plugin.evaluators?.forEach((evaluator) => {
      this.registerEvaluator(evaluator);
    });

    for (const [name, service] of Object.entries(plugin.services ?? {})) {
      this.registerService(name, service);
    }

    plugin.providers?.forEach((provider) => {
      this.registerContextProvider(provider);
    });
  }

  getSetting<T = string>(key: string): T {
    if (key in this.settings && this.settings[key]) {
      return this.settings[key] as T;
    }

    throw new Error('Missing settings: ' + key);
  }

  /**
   * Register an action for the agent to perform.
   * @param action The action to register.
   */
  registerActions(actions: TAction[]) {
    for (const action of actions) {
      this.registerAction(action);
    }
  }
  /**
   * Register an action for the agent to perform.
   * @param action The action to register.
   */
  registerAction(action: TAction) {
    // logger.success(`Registering action: ${action.name}`);
    this.actions.push(action);
  }

  /**
   * Register an evaluator to assess and guide the agent's responses.
   * @param evaluator The evaluator to register.
   */
  registerEvaluator(evaluator: TEvaluator) {
    this.evaluators.push(evaluator);
  }

  /**
   * Register a context provider to provide context for message generation.
   * @param provider The context provider to register.
   */
  registerContextProvider(provider: TProvider) {
    this.providers.push(provider);
  }

  /**
   * Ensure the existence of a participant in the room. If the participant does not exist, they are added to the room.
   * @param userId - The user ID to ensure the existence of.
   * @throws An error if the participant cannot be added.
   */
  async ensureParticipantExists(userId: UUID, roomId: UUID) {
    const participants = await this.db.getParticipantsForAccount(userId);

    if (participants?.length === 0) {
      await this.db.addParticipant(userId, roomId);
    }
  }

  /**
   * Ensure the existence of a user in the database. If the user does not exist, they are added to the database.
   * @param userId - The user ID to ensure the existence of.
   * @param userName - The user name to ensure the existence of.
   * @returns
   */

  async ensureUserExists(userId: UUID, username: string, name: string) {
    const account = await this.db.getAccountById(userId);
    if (!account) {
      await this.db.createAccount({
        id: userId,
        username: username,
        name: name,
      });
    }
  }

  async ensureParticipantInRoom(userId: UUID, roomId: UUID) {
    const participants = await this.db.getParticipantsForRoom(roomId);
    if (!participants.includes(userId)) {
      await this.db.addParticipant(userId, roomId);
      if (userId === this.agentId) {
        // logger.log(
        //   `Agent ${this.character.name} linked to room ${roomId} successfully.`
        // );
      } else {
        // logger.log(
        //   `User ${userId} linked to room ${roomId} successfully.`
        // );
      }
    }
  }

  async ensureConnection(
    userId: UUID,
    roomId: UUID,
    username: string,
    name: string
  ) {
    await Promise.all([
      this.ensureUserExists(
        this.agentId,
        this.character.username,
        this.character.name
      ),
      this.ensureUserExists(userId, username, name),
      this.ensureRoomExists(roomId),
    ]);

    await Promise.all([
      this.ensureParticipantInRoom(userId, roomId),
      this.ensureParticipantInRoom(this.agentId, roomId),
    ]);
  }

  /**
   * Ensure the existence of a room between the agent and a user. If no room exists, a new room is created and the user
   * and agent are added as participants. The room ID is returned.
   * @param userId - The user ID to create a room with.
   * @returns The room ID of the room between the agent and the user.
   * @throws An error if the room cannot be created.
   */
  async ensureRoomExists(roomId: UUID) {
    const room = await this.db.getRoom(roomId);
    if (!room) {
      await this.db.createRoom(roomId);
      //   logger.log(`Room ${roomId} created successfully.`);
    }
  }
}
