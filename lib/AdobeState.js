/*
Copyright 2024 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/* eslint-disable jsdoc/no-undefined-types */
const cloneDeep = require('lodash.clonedeep')
const logger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-state', { provider: 'debug' })
const { HttpExponentialBackoff } = require('@adobe/aio-lib-core-networking')
const url = require('node:url')
const { getCliEnv } = require('@adobe/aio-lib-env')
const Ajv = require('ajv')

const { codes, logAndThrow } = require('./StateError')
const utils = require('./utils')
const {
  REGEX_PATTERN_STORE_KEY,
  HEADER_KEY_EXPIRES,
  CUSTOM_ENDPOINT,
  ENDPOINTS,
  ALLOWED_REGIONS,
  MAX_LIST_COUNT_HINT,
  REQUEST_ID_HEADER,
  MIN_LIST_COUNT_HINT,
  REGEX_PATTERN_MATCH_KEY,
  MAX_TTL_SECONDS,
  ALLOWED_STAGE_REGION
} = require('./constants')

/* *********************************** typedefs *********************************** */

/**
 * AdobeStateCredentials
 *
 * @typedef AdobeStateCredentials
 * @type {object}
 * @property {string} namespace the state store namespace
 * @property {string} apikey the state store api key
 * @property {('amer'|'apac'|'emea')} region the region for the Adobe State Store. defaults to 'amer'
 */

/**
 * AdobeState put options
 *
 * @typedef AdobeStatePutOptions
 * @type {object}
 * @property {number} ttl Time-To-Live for key-value pair in seconds. When not
 *   defined or set to 0, defaults to 24 hours (86400s). Max TTL is one year
 *   (31536000s), `require('@adobe/aio-lib-state').MAX_TTL`. A TTL of 0 defaults
 *   to 24 hours.
 */

/**
 * AdobeState get return object
 *
 * @typedef AdobeStateGetReturnValue
 * @type {object}
 * @property {string} expiration the ISO-8601 date string of the expiration time for the key-value pair
 * @property {string} value the value set by put
 */

/* *********************************** helpers *********************************** */

/**
 * Validates json according to a schema.
 *
 * @param {object} schema the AJV schema
 * @param {object} data the json data to test
 * @returns {object} the result
 * @private
 */
function validate (schema, data) {
  const ajv = new Ajv({ allErrors: true })
  const validate = ajv.compile(schema)
  const valid = validate(data)

  return { valid, errors: validate.errors }
}

/** @private */
async function _wrap (promise, params) {
  let response
  try {
    response = await promise
    logger.debug('response', response)
  } catch (e) {
    logAndThrow(e)
  }

  return handleResponse(response, params)
}

/**
 * Handle a network response.
 *
 * @param {Response} response a fetch Response
 * @param {object} params the params to the network call
 * @returns {void}
 * @private
 */
async function handleResponse (response, params) {
  if (response.ok) {
    return response
  }

  const copyParams = cloneDeep(params)
  copyParams.requestId = response.headers.get(REQUEST_ID_HEADER)

  switch (response.status) {
    case 404:
      return response
    case 401:
      return logAndThrow(new codes.ERROR_UNAUTHORIZED({ messageValues: ['State service'], sdkDetails: copyParams }))
    case 403:
      return logAndThrow(new codes.ERROR_BAD_CREDENTIALS({ messageValues: ['State service'], sdkDetails: copyParams }))
    case 413:
      return logAndThrow(new codes.ERROR_PAYLOAD_TOO_LARGE({ messageValues: ['State service'], sdkDetails: copyParams }))
    case 429:
      return logAndThrow(new codes.ERROR_REQUEST_RATE_TOO_HIGH({ sdkDetails: copyParams }))
    default: // 500 errors
      return logAndThrow(new codes.ERROR_INTERNAL({ messageValues: [`unexpected response from State service with status: ${response.status} body: ${await response.text()}`], sdkDetails: copyParams }))
  }
}

/** @private */
function logDebug (op, url, reqOptions) {
  logger.debug(`${op} ${JSON.stringify({ url, ...utils.withHiddenFields(reqOptions, ['headers.Authorization']) })}`)
}

/**
 * @abstract
 * @class AdobeState
 * @classdesc Cloud State Management
 * @hideconstructor
 */
class AdobeState {
  /**
   * Creates an instance of AdobeState.
   *
   * @memberof AdobeState
   * @private
   * @param {string} namespace the namespace for the Adobe State Store
   * @param {string} apikey the apikey for the Adobe State Store
   * @param {string} env the Adobe environment (AIO_CLI_ENV)
   * @param {('amer'|'apac'|'emea')} [region] the region for the Adobe State Store. defaults to 'amer'
   */
  constructor (namespace, apikey, env, region) {
    /** @private */
    this.namespace = namespace
    /** @private */
    this.apikey = apikey
    /** @private */
    this.basicAuthHeader = `Basic ${Buffer.from(apikey).toString('base64')}`
    /** @private */
    this.region = region
    /** @private */
    this.endpoint = this.getRegionalEndpoint(ENDPOINTS[env], region)
    /** @private */
    this.fetchRetry = new HttpExponentialBackoff()
  }

  /**
   * Gets the regional endpoint for an endpoint.
   *
   * @param {string} endpoint the endpoint to test
   * @param {string} region the region to set
   * @returns {string} the endpoint, with the correct region
   */
  getRegionalEndpoint (endpoint, region) {
    if (CUSTOM_ENDPOINT) {
      return CUSTOM_ENDPOINT
    }

    return endpoint.replaceAll(/<region>/gi, region)
  }

  /**
   * Creates a request url.
   *
   * @private
   * @param {string} containerURLPath defaults to '' to hit the container
   *   endpoint, add /data/key to hit the key endpoint
   * @param {object} queryObject the query variables to send
   * @returns {string} the constructed request url
   */
  createRequestUrl (containerURLPath = '', queryObject = {}) {
    const urlString = `${this.endpoint}/containers/${this.namespace}${containerURLPath}`

    const requestUrl = new url.URL(urlString)
    // add the query params
    requestUrl.search = (new url.URLSearchParams(queryObject)).toString()
    return requestUrl.toString()
  }

  /**
   * Get Authorization headers.
   *
   * @private
   * @returns {string} the authorization headers
   */
  getAuthorizationHeaders () {
    return {
      Authorization: this.basicAuthHeader
    }
  }

  /**
   * Instantiates and returns a new AdobeState object
   *
   * @static
   * @param {AdobeStateCredentials} credentials the credential object
   * @returns {Promise<AdobeState>} a new AdobeState instance
   * @memberof AdobeState
   * @override
   * @private
   */
  static async init (credentials = {}) {
    // include ow environment vars to credentials
    if (!credentials.namespace && !credentials.apikey) {
      credentials.namespace = process.env.__OW_NAMESPACE
      credentials.apikey = process.env.__OW_API_KEY
    }

    const cloned = utils.withHiddenFields(credentials, ['apikey'])
    logger.debug(`init AdobeState with ${JSON.stringify(cloned, null, 2)}`)

    const env = getCliEnv()

    if (env === 'stage' &&
      credentials.region && credentials.region !== ALLOWED_STAGE_REGION) {
      logAndThrow(new codes.ERROR_BAD_ARGUMENT({
        messageValues: `AIO_CLI_ENV=stage only supports the ${ALLOWED_STAGE_REGION} region.`,
        sdkDetails: cloned
      }))
    }

    if (!credentials.region) {
      credentials.region = ALLOWED_REGIONS.at(0) // first item is the default
    }

    const schema = {
      type: 'object',
      properties: {
        region: {
          type: 'string',
          enum: ALLOWED_REGIONS
        },
        apikey: { type: 'string' },
        namespace: { type: 'string' }
      },
      required: ['apikey', 'namespace']
    }

    const { valid, errors } = validate(schema, credentials)
    if (!valid) {
      logAndThrow(new codes.ERROR_BAD_ARGUMENT({
        messageValues: utils.formatAjvErrors(errors),
        sdkDetails: cloned
      }))
    }

    return new AdobeState(credentials.namespace, credentials.apikey, env, credentials.region)
  }

  /* **************************** ADOBE STATE STORE OPERATORS ***************************** */

  /**
   * Retrieves the state value for given key.
   * If the key doesn't exist returns undefined.
   *
   * @param {string} key state key identifier
   * @returns {Promise<AdobeStateGetReturnValue>} get response holding value and additional info
   * @memberof AdobeState
   */
  async get (key) {
    const schema = {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          pattern: REGEX_PATTERN_STORE_KEY
        }
      }
    }

    const { valid, errors } = validate(schema, { key })
    if (!valid) {
      logAndThrow(new codes.ERROR_BAD_ARGUMENT({
        messageValues: utils.formatAjvErrors(errors),
        sdkDetails: { key, errors }
      }))
    }

    const requestOptions = {
      method: 'GET',
      headers: {
        ...this.getAuthorizationHeaders()
      }
    }

    const url = this.createRequestUrl(`/data/${key}`)
    logDebug('get', url, requestOptions)

    const promise = this.fetchRetry.exponentialBackoff(url, requestOptions)
    const response = await _wrap(promise, { key })
    if (response.ok) {
      // we only expect string values
      const value = await response.text()
      const expiration = new Date(Number(response.headers.get(HEADER_KEY_EXPIRES))).toISOString()

      return { value, expiration }
    }
  }

  /**
   * Creates or updates a state key-value pair
   *
   * @param {string} key state key identifier
   * @param {string} value state value
   * @param {AdobeStatePutOptions} [options] put options
   * @returns {Promise<string>} key
   * @memberof AdobeState
   */
  async put (key, value, options = {}) {
    logger.debug(`put '${key}' with options ${JSON.stringify(options)}`)

    const schema = {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          pattern: REGEX_PATTERN_STORE_KEY
        },
        value: {
          type: 'string'
        },
        ttl: {
          type: 'integer'
        }
      }
    }

    // validation
    const { ttl } = options
    const { valid, errors } = validate(schema, { key, value, ttl })
    if (!valid) {
      logAndThrow(new codes.ERROR_BAD_ARGUMENT({
        messageValues: utils.formatAjvErrors(errors),
        sdkDetails: { key, valueLength: value.length, options, errors }
      }))
    }
    if (ttl !== undefined && (ttl < 0 || ttl > MAX_TTL_SECONDS)) {
      // error message is nicer like this than for
      logAndThrow(new codes.ERROR_BAD_ARGUMENT({
        messageValues: 'ttl must be <= 365 days (31536000s). Infinite TTLs (< 0) are not supported.',
        sdkDetails: { key, valueLength: value.length, options }
      }))
    }

    const queryParams = ttl !== undefined ? { ttl } : {}
    const requestOptions = {
      method: 'PUT',
      headers: {
        ...this.getAuthorizationHeaders(),
        'Content-Type': 'application/octet-stream'
      },
      body: value
    }

    const url = this.createRequestUrl(`/data/${key}`, queryParams)

    logDebug('put', url, requestOptions)
    const promise = this.fetchRetry.exponentialBackoff(
      url,
      requestOptions
    )
    await _wrap(promise, { key, value, ...options }, true)
    return key
  }

  /**
   * Deletes a state key-value pair
   *
   * @param {string} key state key identifier
   * @returns {Promise<string|null>} key of deleted state or `null` if state does not exist
   * @memberof AdobeState
   */
  async delete (key) {
    logger.debug(`delete '${key}'`)

    const requestOptions = {
      method: 'DELETE',
      headers: {
        ...this.getAuthorizationHeaders()
      }
    }

    const schema = {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          pattern: REGEX_PATTERN_STORE_KEY
        }
      }
    }
    const { valid, errors } = validate(schema, { key })
    if (!valid) {
      logAndThrow(new codes.ERROR_BAD_ARGUMENT({
        messageValues: utils.formatAjvErrors(errors),
        sdkDetails: { key, errors }
      }))
    }

    const url = this.createRequestUrl(`/data/${key}`)

    logDebug('delete', url, requestOptions)
    const promise = this.fetchRetry.exponentialBackoff(url, requestOptions)
    const response = await _wrap(promise, { key })
    if (response.status === 404) {
      return null
    } else {
      return key
    }
  }

  /**
   * Deletes multiple key-values. The match option is required as a safeguard.
   * CAUTION: use `{ match: '*' }` to delete all key-values.
   * @example
   *  await state.deleteAll({ match: 'abc*' })
   * @param {object} options deleteAll options.
   * @param {string} options.match REQUIRED, a glob pattern to specify which keys to delete.
   * @returns {Promise<{ keys: number }>} returns an object with the number of deleted keys.
   * @memberof AdobeState
   */
  async deleteAll (options = {}) {
    const requestOptions = {
      method: 'DELETE',
      headers: {
        ...this.getAuthorizationHeaders()
      }
    }

    const schema = {
      type: 'object',
      properties: {
        match: { type: 'string', pattern: REGEX_PATTERN_MATCH_KEY }
      },
      required: ['match'] // safeguard, you cannot call deleteAll without matching specific keys!
    }
    const { valid, errors } = validate(schema, options)
    if (!valid) {
      logAndThrow(new codes.ERROR_BAD_ARGUMENT({
        messageValues: utils.formatAjvErrors(errors),
        sdkDetails: { options, errors }
      }))
    }

    const queryParams = { matchData: options.match }
    const url = this.createRequestUrl('', queryParams)

    logDebug('deleteAll', url, requestOptions)

    // ! be extra cautious, if the `matchData` param is not specified the whole container will be deleted
    const promise = this.fetchRetry.exponentialBackoff(url, requestOptions)
    const response = await _wrap(promise, {})

    if (response.status === 404) {
      return { keys: 0 }
    } else {
      const { keys } = await response.json()
      return { keys }
    }
  }

  /**
   * There exists key-values in the region.
   *
   * @returns {Promise<boolean>} true if exists, false if not
   * @memberof AdobeState
   */
  async any () {
    const requestOptions = {
      method: 'HEAD',
      headers: {
        ...this.getAuthorizationHeaders()
      }
    }

    const url = this.createRequestUrl()
    logDebug('any', url, requestOptions)

    const promise = this.fetchRetry.exponentialBackoff(url, requestOptions)
    const response = await _wrap(promise, {})
    return (response.status !== 404)
  }

  /**
   * Get stats.
   *
   * @returns {Promise<{ bytesKeys: number, bytesValues: number, keys: number }>} State container stats.
   * @memberof AdobeState
   */
  async stats () {
    const requestOptions = {
      method: 'GET',
      headers: {
        ...this.getAuthorizationHeaders()
      }
    }

    const url = this.createRequestUrl()
    logDebug('stats', url, requestOptions)

    const promise = this.fetchRetry.exponentialBackoff(url, requestOptions)
    const response = await _wrap(promise, {})
    if (response.status === 404) {
      return { keys: 0, bytesKeys: 0, bytesValues: 0 }
    } else {
      const { keys, bytesKeys, bytesValues } = await response.json()
      return { keys, bytesKeys, bytesValues }
    }
  }

  /**
   * List keys, returns an iterator. Every iteration returns a batch of
   * approximately `countHint` keys.
   * @example
   *  for await (const { keys } of state.list({ match: 'abc*' })) {
   *    console.log(keys)
   *  }
   * @param {object} options list options
   * @param {string} options.match a glob pattern that supports '*' to filter
   *   keys.
   * @param {number} options.countHint an approximate number on how many items
   *   to return per iteration. Default: 100, min: 10, max: 1000.
   * @returns {AsyncGenerator<{ keys: string[] }>} an async generator which yields a
   *   { keys } object at every iteration.
   * @memberof AdobeState
   */
  list (options = {}) {
    logger.debug('list', options)
    const requestOptions = {
      method: 'GET',
      headers: {
        ...this.getAuthorizationHeaders()
      }
    }

    const queryParams = {}
    if (options.match) {
      queryParams.match = options.match
    }
    if (options.countHint) {
      queryParams.countHint = options.countHint
    }

    if (queryParams.countHint < MIN_LIST_COUNT_HINT || queryParams.countHint > MAX_LIST_COUNT_HINT) {
      logAndThrow(new codes.ERROR_BAD_ARGUMENT({
        messageValues: `'countHint' must be in the [${MIN_LIST_COUNT_HINT}, ${MAX_LIST_COUNT_HINT}] range`,
        sdkDetails: { queryParams }
      }))
    }
    const schema = {
      type: 'object',
      properties: {
        match: { type: 'string', pattern: REGEX_PATTERN_MATCH_KEY },
        countHint: { type: 'integer' }
      }
    }

    const { valid, errors } = validate(schema, queryParams)
    if (!valid) {
      logAndThrow(new codes.ERROR_BAD_ARGUMENT({
        messageValues: utils.formatAjvErrors(errors),
        sdkDetails: { queryParams, errors }
      }))
    }

    const stateInstance = this
    return (async function * iter () {
      let cursor = 0

      do {
        const url = stateInstance.createRequestUrl('/data', { ...queryParams, cursor })
        logDebug('list', url, requestOptions)

        const promise = stateInstance.fetchRetry.exponentialBackoff(
          url,
          requestOptions
        )
        const response = await _wrap(promise, { ...queryParams, cursor })
        if (response.status === 404) {
          yield { keys: [] }
          return
        }
        const res = await response.json()
        cursor = res.cursor

        yield { keys: res.keys }
      } while (cursor !== 0)
    }())
  }
}

module.exports = { AdobeState }
