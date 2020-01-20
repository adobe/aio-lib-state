/**
 * StateStore put options
 *
 * @typedef StateStorePutOptions
 * @type {object}
 * @property {number} ttl time-to-live for key-value pair in seconds, defaults to 24 hours (86400s). Set to < 0 for no expiry. A
 * value of 0 sets default.
 */
declare type StateStorePutOptions = {
    ttl: number;
};

/**
 * StateStore get return object
 *
 * @typedef StateStoreGetReturnValue
 * @type {object}
 * @property {string|null} expiration ISO date string of expiration time for the key-value pair, if the ttl is infinite
 * expiration=null
 * @property {any} value the value set by put
 */
declare type StateStoreGetReturnValue = {
    expiration: string | null;
    value: any;
};

/**
 * @abstract
 * @class StateStore
 * @classdesc Cloud State Management
 * @hideconstructor
 */
declare class StateStore {
    /**
     * Retrieves the state value for given key.
     * If the key doesn't exist returns undefined.
     *
     * @param {string} key state key identifier
     * @returns {Promise<StateStoreGetReturnValue>} get response holding value and additional info
     * @memberof StateStore
     */
    get(key: string): Promise<StateStoreGetReturnValue>;
    /**
     * Creates or updates a state key-value pair
     *
     * @param {string} key state key identifier
     * @param {any} value state value
     * @param {StateStorePutOptions} [options={}] put options
     * @returns {Promise<string>} key
     * @memberof StateStore
     */
    put(key: string, value: any, options?: StateStorePutOptions): Promise<string>;
    /**
     * Deletes a state key-value pair
     *
     * @param {string} key state key identifier
     * @returns {Promise<string>} key of deleted state or `null` if state does not exists
     * @memberof StateStore
     */
    delete(key: string): Promise<string>;
}

/**
 * State lib custom errors.
 * `e.sdkDetails` provides additional context for each error (e.g. function parameter)
 *
 * @typedef StateLibErrors
 * @type {object}
 * @property {StateLibError} ERROR_BAD_ARGUMENT this error is thrown when an argument is missing or has invalid type
 * @property {StateLibError} ERROR_NOT_IMPLEMENTED this error is thrown when a method is not implemented or when calling
 * methods directly on the abstract class (StateStore).
 * @property {StateLibError} ERROR_PAYLOAD_TOO_LARGE this error is thrown when the state key, state value or underlying request payload size
 * exceeds the specified limitations.
 * @property {StateLibError} ERROR_BAD_CREDENTIALS this error is thrown when the supplied init credentials are invalid.
 * @property {StateLibError} ERROR_INTERNAL this error is thrown when an unknown error is thrown by the underlying
 * DB provider or TVM server for credential exchange. More details can be found in `e.sdkDetails._internal`.
 */
declare type StateLibErrors = {
    ERROR_BAD_ARGUMENT: StateLibError;
    ERROR_NOT_IMPLEMENTED: StateLibError;
    ERROR_PAYLOAD_TOO_LARGE: StateLibError;
    ERROR_BAD_CREDENTIALS: StateLibError;
    ERROR_INTERNAL: StateLibError;
};

/**
 * An object holding the OpenWhisk credentials
 *
 * @typedef OpenWhiskCredentials
 * @type {object}
 * @property {string} namespace user namespace
 * @property {string} auth auth key
 */
declare type OpenWhiskCredentials = {
    namespace: string;
    auth: string;
};

/**
 * An object holding the Azure Cosmos resource credentials with permissions on a single partition and container
 *
 * @typedef AzureCosmosPartitionResourceCredentials
 * @type {object}
 * @property {string} endpoint cosmosdb resource endpoint
 * @property {string} resourceToken cosmosdb resource token restricted to the partitionKey
 * @property {string} databaseId id for cosmosdb database
 * @property {string} containerId id for cosmosdb container within database
 * @property {string} partitionKey key for cosmosdb partition within container authorized by resource token
 *
 */
declare type AzureCosmosPartitionResourceCredentials = {
    endpoint: string;
    resourceToken: string;
    databaseId: string;
    containerId: string;
    partitionKey: string;
};

/**
 * An object holding the Azure Cosmos account master key
 *
 * @typedef AzureCosmosMasterCredentials
 * @type {object}
 * @property {string} endpoint cosmosdb resource endpoint
 * @property {string} masterKey cosmosdb account masterKey
 * @property {string} databaseId id for cosmosdb database
 * @property {string} containerId id for cosmosdb container within database
 * @property {string} partitionKey key for cosmosdb partition where data will be stored
 *
 */
declare type AzureCosmosMasterCredentials = {
    endpoint: string;
    masterKey: string;
    databaseId: string;
    containerId: string;
    partitionKey: string;
};

/**
 * Initializes and returns the key-value-store SDK.
 *
 * To use the SDK you must either provide your
 * [OpenWhisk credentials]{@link OpenWhiskCredentials} in
 * `config.ow` or your own
 * [Azure Cosmos credentials]{@link AzureCosmosMasterCredentials} in `config.cosmos`.
 *
 * OpenWhisk credentials can also be read from environment variables `__OW_NAMESPACE` and `__OW_API_KEY`.
 *
 * @param {object} [config={}] used to init the sdk
 *
 * @param {OpenWhiskCredentials} [config.ow]
 * {@link OpenWhiskCredentials}. Set those if you want
 * to use ootb credentials to access the state management service. OpenWhisk
 * namespace and auth can also be passed through environment variables:
 * `__OW_NAMESPACE` and `__OW_API_KEY`
 *
 * @param {AzureCosmosMasterCredentials|AzureCosmosPartitionResourceCredentials} [config.cosmos]
 * [Azure Cosmos resource credentials]{@link AzureCosmosPartitionResourceCredentials} or
 * [Azure Cosmos account credentials]{@link AzureCosmosMasterCredentials}
 *
 * @param {object} [config.tvm] tvm configuration, applies only when passing OpenWhisk credentials
 * @param {string} [config.tvm.apiUrl] alternative tvm api url.
 * @param {string} [config.tvm.cacheFile] alternative tvm cache file, set to `false` to disable caching of temporary credentials.
 * @returns {Promise<StateStore>} A StateStore instance
 */
declare function init(config?: {
    ow?: OpenWhiskCredentials;
    cosmos?: AzureCosmosMasterCredentials | AzureCosmosPartitionResourceCredentials;
    tvm?: {
        apiUrl?: string;
        cacheFile?: string;
    };
}): Promise<StateStore>;

