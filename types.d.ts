/**
 * StateStore put options
 * @property ttl - time-to-live for key-value pair in seconds, defaults to 24 hours (86400s). Set to < 0 for no expiry. A
 * value of 0 sets default.
 */
export type StateStorePutOptions = {
    ttl: number;
};

/**
 * StateStore get return object
 * @property expiration - ISO date string of expiration time for the key-value pair, if the ttl is infinite
 * expiration=null
 * @property value - the value set by put
 */
export type StateStoreGetReturnValue = {
    expiration: string | null;
    value: any;
};

/**
 * Cloud State Management
 */
export class StateStore {
    /**
     * Retrieves the state value for given key.
     * If the key doesn't exist returns undefined.
     * @param key - state key identifier
     * @returns get response holding value and additional info
     */
    get(key: string): Promise<StateStoreGetReturnValue>;
    /**
     * Creates or updates a state key-value pair
     * @param key - state key identifier
     * @param value - state value
     * @param [options = {}] - put options
     * @returns key
     */
    put(key: string, value: any, options?: StateStorePutOptions): Promise<string>;
    /**
     * Deletes a state key-value pair
     * @param key - state key identifier
     * @returns key of deleted state or `null` if state does not exists
     */
    delete(key: string): Promise<string>;
    /**
     * @param key - state key identifier
     * @returns get response holding value and additional info
     */
    protected _get(key: string): Promise<StateStoreGetReturnValue>;
    /**
     * @param key - state key identifier
     * @param value - state value
     * @param options - state put options
     * @returns key
     */
    protected _put(key: string, value: any, options: any): Promise<string>;
    /**
     * @param key - state key identifier
     * @returns key of deleted state or `null` if state does not exists
     */
    protected _delete(key: string): Promise<string>;
}

/**
 * @property message - The message for the Error
 * @property code - The code for the Error
 * @property sdk - The SDK associated with the Error
 * @property sdkDetails - The SDK details associated with the Error
 */
export type StateLibError = {
    message: string;
    code: string;
    sdk: string;
    sdkDetails: any;
};

/**
 * State lib custom errors.
 * `e.sdkDetails` provides additional context for each error (e.g. function parameter)
 * @property ERROR_BAD_ARGUMENT - this error is thrown when an argument is missing or has invalid type
 * @property ERROR_BAD_REQUEST - this error is thrown when an argument has an illegal value.
 * @property ERROR_NOT_IMPLEMENTED - this error is thrown when a method is not implemented or when calling
 * methods directly on the abstract class (StateStore).
 * @property ERROR_PAYLOAD_TOO_LARGE - this error is thrown when the state key, state value or underlying request payload size
 * exceeds the specified limitations.
 * @property ERROR_BAD_CREDENTIALS - this error is thrown when the supplied init credentials are invalid.
 * @property ERROR_INTERNAL - this error is thrown when an unknown error is thrown by the underlying
 * DB provider or TVM server for credential exchange. More details can be found in `e.sdkDetails._internal`.
 */
export type StateLibErrors = {
    ERROR_BAD_ARGUMENT: StateLibError;
    ERROR_BAD_REQUEST: StateLibError;
    ERROR_NOT_IMPLEMENTED: StateLibError;
    ERROR_PAYLOAD_TOO_LARGE: StateLibError;
    ERROR_BAD_CREDENTIALS: StateLibError;
    ERROR_INTERNAL: StateLibError;
};

/**
 * An object holding the OpenWhisk credentials
 * @property namespace - user namespace
 * @property auth - auth key
 */
export type OpenWhiskCredentials = {
    namespace: string;
    auth: string;
};

/**
 * An object holding the Azure Cosmos resource credentials with permissions on a single partition and container
 * @property endpoint - cosmosdb resource endpoint
 * @property resourceToken - cosmosdb resource token restricted to the partitionKey
 * @property databaseId - id for cosmosdb database
 * @property containerId - id for cosmosdb container within database
 * @property partitionKey - key for cosmosdb partition within container authorized by resource token
 */
export type AzureCosmosPartitionResourceCredentials = {
    endpoint: string;
    resourceToken: string;
    databaseId: string;
    containerId: string;
    partitionKey: string;
};

/**
 * An object holding the Azure Cosmos account master key
 * @property endpoint - cosmosdb resource endpoint
 * @property masterKey - cosmosdb account masterKey
 * @property databaseId - id for cosmosdb database
 * @property containerId - id for cosmosdb container within database
 * @property partitionKey - key for cosmosdb partition where data will be stored
 */
export type AzureCosmosMasterCredentials = {
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
 * @param [config = {}] - used to init the sdk
 * @param [config.ow] - {@link OpenWhiskCredentials}. Set those if you want
 * to use ootb credentials to access the state management service. OpenWhisk
 * namespace and auth can also be passed through environment variables:
 * `__OW_NAMESPACE` and `__OW_API_KEY`
 * @param [config.cosmos] - [Azure Cosmos resource credentials]{@link AzureCosmosPartitionResourceCredentials} or
 * [Azure Cosmos account credentials]{@link AzureCosmosMasterCredentials}
 * @param [config.tvm] - tvm configuration, applies only when passing OpenWhisk credentials
 * @param [config.tvm.apiUrl] - alternative tvm api url.
 * @param [config.tvm.cacheFile] - alternative tvm cache file, set to `false` to disable caching of temporary credentials.
 * @returns A StateStore instance
 */
export function init(config?: {
    ow?: OpenWhiskCredentials;
    cosmos?: AzureCosmosMasterCredentials | AzureCosmosPartitionResourceCredentials;
    tvm?: {
        apiUrl?: string;
        cacheFile?: string;
    };
}): Promise<StateStore>;

