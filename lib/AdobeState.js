/* eslint-disable jsdoc/no-undefined-types */
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
  API_VERSION,
  HEADER_KEY_EXPIRES,
  CUSTOM_ENDPOINT,
  ENDPOINTS,
  ALLOWED_REGIONS,
  MAX_LIST_COUNT_HINT,
  REQUEST_ID_HEADER,
  MIN_LIST_COUNT_HINT,
  REGEX_PATTERN_LIST_KEY_MATCH
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
 * @property {number} ttl time-to-live for key-value pair in seconds, defaults to 24 hours (86400s). Set to < 0 for max ttl of one year. A
 * value of 0 sets default.
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
 */
function validate (schema, data) {
  const ajv = new Ajv({ allErrors: true })
  const validate = ajv.compile(schema)
  const valid = validate(data)

  return { valid, errors: validate.errors }
}

// eslint-disable-next-line jsdoc/require-jsdoc
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
   * @param {('amer'|'apac'|'emea')} [region] the region for the Adobe State Store. defaults to 'amer'
   */
  constructor (namespace, apikey, region) {
    /** @private */
    this.namespace = namespace
    /** @private */
    this.apikey = apikey
    /** @private */
    this.basicAuthHeader = `Basic ${Buffer.from(apikey).toString('base64')}`
    /** @private */
    this.region = region
    /** @private */
    this.endpoint = this.getRegionalEndpoint(ENDPOINTS[getCliEnv()], region)
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
    const urlString = `${this.endpoint}/${API_VERSION}/containers/${this.namespace}${containerURLPath}`

    logger.debug('requestUrl string', urlString)
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

    return new AdobeState(credentials.namespace, credentials.apikey, credentials.region)
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
    logger.debug(`get '${key}'`)

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
    logger.debug('get', requestOptions)
    const promise = this.fetchRetry.exponentialBackoff(this.createRequestUrl(`/data/${key}`), requestOptions)
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
        }
      }
    }

    const { valid, errors } = validate(schema, { key, value })
    if (!valid) {
      logAndThrow(new codes.ERROR_BAD_ARGUMENT({
        messageValues: utils.formatAjvErrors(errors),
        sdkDetails: { key, value, options, errors }
      }))
    }

    const { ttl } = options
    const queryParams = ttl ? { ttl } : {}
    const requestOptions = {
      method: 'PUT',
      headers: {
        ...this.getAuthorizationHeaders(),
        'Content-Type': 'application/octet-stream'
      },
      body: value
    }

    logger.debug('put', requestOptions)

    const promise = this.fetchRetry.exponentialBackoff(
      this.createRequestUrl(`/data/${key}`, queryParams),
      requestOptions
    )
    await _wrap(promise, { key, value, ...options }, true)
    return key
  }

  /**
   * Deletes a state key-value pair
   *
   * @param {string} key state key identifier
   * @returns {Promise<string>} key of deleted state or `null` if state does not exist
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

    logger.debug('delete', requestOptions)

    const promise = this.fetchRetry.exponentialBackoff(this.createRequestUrl(`/data/${key}`), requestOptions)
    const response = await _wrap(promise, { key })
    if (response.status === 404) {
      return null
    } else {
      return key
    }
  }

  /**
   * Deletes all key-values
   *
   * @returns {Promise<boolean>} true if deleted, false if not
   * @memberof AdobeState
   */
  async deleteAll () {
    const requestOptions = {
      method: 'DELETE',
      headers: {
        ...this.getAuthorizationHeaders()
      }
    }

    logger.debug('deleteAll', requestOptions)

    const promise = this.fetchRetry.exponentialBackoff(this.createRequestUrl(), requestOptions)
    const response = await _wrap(promise, {})
    return (response.status !== 404)
  }

  /**
   * There exists key-values.
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

    logger.debug('any', requestOptions)

    const promise = this.fetchRetry.exponentialBackoff(this.createRequestUrl(), requestOptions)
    const response = await _wrap(promise, {})
    return (response.status !== 404)
  }

  /**
   * Get stats.
   *
   * @returns {Promise<{ bytesKeys: number, bytesValues: number, keys: number} | boolean>} namespace stats or false if not exists
   * @memberof AdobeState
   */
  async stats () {
    const requestOptions = {
      method: 'GET',
      headers: {
        ...this.getAuthorizationHeaders()
      }
    }

    logger.debug('stats', requestOptions)

    const promise = this.fetchRetry.exponentialBackoff(this.createRequestUrl(), requestOptions)
    const response = await _wrap(promise, {})
    if (response.status === 404) {
      return false
    } else {
      return response.json()
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
   * @returns {AsyncGenerator<{ keys: [] }>} an async generator which yields a
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
    logger.debug('list', requestOptions)

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
        match: { type: 'string', pattern: REGEX_PATTERN_LIST_KEY_MATCH }, // this is an important check
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
        const promise = stateInstance.fetchRetry.exponentialBackoff(
          stateInstance.createRequestUrl('/data', { ...queryParams, cursor }),
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
