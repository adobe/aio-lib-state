/**
 * AdobeStateCredentials
 * @property namespace - the state store namespace
 * @property apikey - the state store api key
 * @property region - the region for the Adobe State Store. defaults to 'amer'
 */
export type AdobeStateCredentials = {
    namespace: string;
    apikey: string;
    region: 'amer' | 'apac' | 'emea';
};

/**
 * AdobeState put options
 * @property ttl - time-to-live for key-value pair in seconds, defaults to 24 hours (86400s). Set to < 0 for max ttl of one year. A
 * value of 0 sets default.
 */
export type AdobeStatePutOptions = {
    ttl: number;
};

/**
 * AdobeState get return object
 * @property expiration - the ISO-8601 date string of the expiration time for the key-value pair
 * @property value - the value set by put
 */
export type AdobeStateGetReturnValue = {
    expiration: string;
    value: string;
};

/**
 * Validates json according to a schema.
 * @param schema - the AJV schema
 * @param data - the json data to test
 * @returns the result
 */
export function validate(schema: any, data: any): any;

/**
 * Handle a network response.
 * @param response - a fetch Response
 * @param params - the params to the network call
 */
export function handleResponse(response: Response, params: any): void;

/**
 * Cloud State Management
 */
export class AdobeState {
    /**
     * Gets the regional endpoint for an endpoint.
     * @param endpoint - the endpoint to test
     * @param region - the region to set
     * @returns the endpoint, with the correct region
     */
    getRegionalEndpoint(endpoint: string, region: string): string;
    /**
     * Retrieves the state value for given key.
     * If the key doesn't exist returns undefined.
     * @param key - state key identifier
     * @returns get response holding value and additional info
     */
    get(key: string): Promise<AdobeStateGetReturnValue>;
    /**
     * Creates or updates a state key-value pair
     * @param key - state key identifier
     * @param value - state value
     * @param [options] - put options
     * @returns key
     */
    put(key: string, value: string, options?: AdobeStatePutOptions): Promise<string>;
    /**
     * Deletes a state key-value pair
     * @param key - state key identifier
     * @returns key of deleted state or `null` if state does not exist
     */
    delete(key: string): Promise<string>;
    /**
     * Deletes all key-values
     * @returns true if deleted, false if not
     */
    deleteAll(): Promise<boolean>;
    /**
     * There exists key-values.
     * @returns true if exists, false if not
     */
    any(): Promise<boolean>;
    /**
     * Get stats.
     * @returns namespace stats or false if not exists
     */
    stats(): Promise<{ bytesKeys: number; bytesValues: number; keys: number; } | boolean>;
    /**
     * List keys, returns an iterator. Every iteration returns a batch of
     * approximately `countHint` keys.
     * @example
     * for await (const { keys } of state.list({ match: 'abc*' })) {
     *    console.log(keys)
     *  }
     * @param options - list options
     * @param options.match - a glob pattern that supports '*' to filter
     *   keys.
     * @param options.countHint - an approximate number on how many items
     *   to return per iteration. Default: 100, min: 10, max: 1000.
     * @returns an async generator which yields a
     *   { keys } object at every iteration.
     */
    list(options: {
        match: string;
        countHint: number;
    }): AsyncGenerator<{ keys: string[]; }>;
}

/**
 * @property message - The message for the Error
 * @property code - The code for the Error
 * @property sdk - The SDK associated with the Error
 * @property sdkDetails - The SDK details associated with the Error
 */
export type AdobeStateLibError = {
    message: string;
    code: string;
    sdk: string;
    sdkDetails: any;
};

/**
 * Adobe State lib custom errors.
 * `e.sdkDetails` provides additional context for each error (e.g. function parameter)
 * @property ERROR_BAD_ARGUMENT - this error is thrown when an argument is missing, has invalid type, or includes invalid characters.
 * @property ERROR_BAD_REQUEST - this error is thrown when an argument has an illegal value.
 * @property ERROR_PAYLOAD_TOO_LARGE - this error is thrown when the state key, state value or underlying request payload size
 * exceeds the specified limitations.
 * @property ERROR_BAD_CREDENTIALS - this error is thrown when the supplied init credentials are invalid.
 * @property ERROR_UNAUTHORIZED - this error is thrown when the credentials are unauthorized to access the resource
 * @property ERROR_INTERNAL - this error is thrown when an unknown error is thrown by the underlying
 * DB provider or TVM server for credential exchange. More details can be found in `e.sdkDetails._internal`.
 * @property ERROR_REQUEST_RATE_TOO_HIGH - this error is thrown when the request rate for accessing state is too high.
 */
export type AdobeStateLibErrors = {
    ERROR_BAD_ARGUMENT: AdobeStateLibError;
    ERROR_BAD_REQUEST: AdobeStateLibError;
    ERROR_PAYLOAD_TOO_LARGE: AdobeStateLibError;
    ERROR_BAD_CREDENTIALS: AdobeStateLibError;
    ERROR_UNAUTHORIZED: AdobeStateLibError;
    ERROR_INTERNAL: AdobeStateLibError;
    ERROR_REQUEST_RATE_TOO_HIGH: AdobeStateLibError;
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
 * Initializes and returns the key-value-store SDK.
 *
 * To use the SDK you must either provide your
 * [OpenWhisk credentials]{@link OpenWhiskCredentials} in
 * `config.ow` or your own
 *
 * OpenWhisk credentials can also be read from environment variables `__OW_NAMESPACE` and `__OW_API_KEY`.
 * @param [config] - used to init the sdk
 * @param [config.ow] - {@link OpenWhiskCredentials}. Set those if you want
 * to use ootb credentials to access the state management service. OpenWhisk
 * namespace and auth can also be passed through environment variables:
 * `__OW_NAMESPACE` and `__OW_API_KEY`
 * @returns An AdobeState instance
 */
export function init(config?: {
    ow?: OpenWhiskCredentials;
}): Promise<AdobeState>;

