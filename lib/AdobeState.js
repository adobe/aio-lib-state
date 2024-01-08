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
const { codes, logAndThrow } = require('./StateError')
const utils = require('./utils')
const cloneDeep = require('lodash.clonedeep')
const logger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-state', { provider: 'debug' })
const { HttpExponentialBackoff } = require('@adobe/aio-lib-core-networking')
const url = require('node:url')
const { getCliEnv } = require('@adobe/aio-lib-env')
const { ADOBE_STATE_STORE_ENDPOINT, REGEX_PATTERN_STORE_KEY } = require('./constants')
const Ajv = require('ajv')

/* *********************************** typedefs *********************************** */

/**
 * AdobeStateCredentials
 *
 * @typedef AdobeStateCredentials
 * @type {object}
 * @property {string} namespace the state store namespace
 * @property {string} apikey the state store api key
 */

/**
 * AdobeState put options
 *
 * @typedef AdobeStatePutOptions
 * @type {object}
 * @property {number} ttl time-to-live for key-value pair in seconds, defaults to 24 hours (86400s). Set to < 0 for no expiry. A
 * value of 0 sets default.
 */

/**
 * AdobeState get return object
 *
 * @typedef AdobeStateGetReturnValue
 * @type {object}
 * @property {string|null} expiration ISO date string of expiration time for the key-value pair, if the ttl is infinite
 * expiration=null
 * @property {any} value the value set by put
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
    // reuse code in exception handler, for any other network exceptions
    if (!response.ok) {
      // no exception on 404
      if (response.status === 404) {
        return null
      } else {
        const e = new Error(response.statusText)
        e.status = response.status
        e.internal = response
        throw e
      }
    }
  } catch (e) {
    const status = e.status || e.code
    const copyParams = cloneDeep(params)
    logger.debug(`got internal error with status ${status}: ${e.message} `)
    switch (status) {
      case 401:
        return logAndThrow(new codes.ERROR_UNAUTHORIZED({ messageValues: ['underlying DB provider'], sdkDetails: copyParams }))
      case 403:
        return logAndThrow(new codes.ERROR_BAD_CREDENTIALS({ messageValues: ['underlying DB provider'], sdkDetails: copyParams }))
      case 413:
        return logAndThrow(new codes.ERROR_PAYLOAD_TOO_LARGE({ messageValues: ['underlying DB provider'], sdkDetails: copyParams }))
      case 429:
        return logAndThrow(new codes.ERROR_REQUEST_RATE_TOO_HIGH({ sdkDetails: copyParams }))
      default:
        return logAndThrow(new codes.ERROR_INTERNAL({ messageValues: [`unexpected response from provider with status: ${status}`], sdkDetails: { ...cloneDeep(params), _internal: e.internal } }))
    }
  }
  return response
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
   */
  constructor (namespace, apikey) {
    /** @private */
    this.namespace = namespace
    /** @private */
    this.apikey = apikey
    /** @private */
    this.endpoint = ADOBE_STATE_STORE_ENDPOINT[getCliEnv()]
    /** @private */
    this.fetchRetry = new HttpExponentialBackoff()
  }

  /**
   * Creates a request url.
   *
   * @private
   * @param {string} key the key of the state store
   * @param {object} queryObject the query variables to send
   * @returns {string} the constructed request url
   */
  createRequestUrl (key, queryObject = {}) {
    let requestUrl

    if (key) {
      requestUrl = new url.URL(`${this.endpoint}/v1/containers/${this.namespace}/data/${key}`)
    } else {
      requestUrl = new url.URL(`${this.endpoint}/v1/containers/${this.namespace}`)
    }

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
      Authorization: `Basic ${this.apikey}`
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

    const schema = {
      type: 'object',
      properties: {
        apikey: { type: 'string' },
        namespace: { type: 'string' }
      },
      required: ['apikey', 'namespace']
    }

    const { valid, errors } = validate(schema, credentials)
    if (!valid) {
      logAndThrow(new codes.ERROR_BAD_ARGUMENT({
        messageValues: ['apikey and/or namespace is missing', JSON.stringify(errors, null, 2)],
        sdkDetails: cloned
      }))
    }

    return new AdobeState(credentials.namespace, credentials.apikey)
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
        messageValues: ['invalid key', JSON.stringify(errors, null, 2)],
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
    const promise = this.fetchRetry.exponentialBackoff(this.createRequestUrl(key), requestOptions)
    const response = await _wrap(promise, { key })
    if (response) {
      // we only expect string values
      return response.json()
    }
  }

  /**
   * Creates or updates a state key-value pair
   *
   * @param {string} key state key identifier
   * @param {string} value state value
   * @param {AdobeStatePutOptions} [options={}] put options
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
        messageValues: ['invalid key and/or value', JSON.stringify(errors, null, 2)],
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

    const promise = this.fetchRetry.exponentialBackoff(this.createRequestUrl(key, queryParams), requestOptions)
    await _wrap(promise, { key, value, ...options })
    return key
  }

  /**
   * Deletes a state key-value pair
   *
   * @param {string} key state key identifier
   * @returns {Promise<string>} key of deleted state or `null` if state does not exists
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

    const promise = this.fetchRetry.exponentialBackoff(this.createRequestUrl(key), requestOptions)
    const ret = await _wrap(promise, { key })
    return ret && key
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
    return response !== null
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
    return response !== null
  }
}

module.exports = { AdobeState }
