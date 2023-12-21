/*
Copyright 2023 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const { codes, logAndThrow } = require('./AdobeStateStoreError')
const joi = require('joi')
const utils = require('./utils')
const cloneDeep = require('lodash.clonedeep')
const logger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-state', { provider: 'debug' })
const { HttpExponentialBackoff } = require('@adobe/aio-lib-core-networking')
const url = require('node:url')
const { Readable } = require('node:stream')
const { getCliEnv } = require('@adobe/aio-lib-env')
const { ADOBE_STATE_STORE_ENDPOINT } = require('./constants')

/* *********************************** typedefs *********************************** */

/**
 * AdobeStateStoreCredentials
 *
 * @typedef AdobeStateStoreCredentials
 * @type {object}
 * @property {string} namespace the state store namespace
 * @property {string} apikey the state store api key
 */

/**
 * AdobeStateStore put options
 *
 * @typedef AdobeStateStorePutOptions
 * @type {object}
 * @property {number} ttl time-to-live for key-value pair in seconds, defaults to 24 hours (86400s). Set to < 0 for no expiry. A
 * value of 0 sets default.
 */

/**
 * AdobeStateStore get return object
 *
 * @typedef AdobeStateStoreGetReturnValue
 * @type {object}
 * @property {string|null} expiration ISO date string of expiration time for the key-value pair, if the ttl is infinite
 * expiration=null
 * @property {any} value the value set by put
 */

/* *********************************** helpers *********************************** */

// eslint-disable-next-line jsdoc/require-jsdoc
async function _wrap (promise, params) {
  let response
  try {
    response = await promise
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
 * @class AdobeStateStore
 * @classdesc Cloud State Management
 * @hideconstructor
 */
class AdobeStateStore {
  /**
   * Creates an instance of AdobeStateStore.
   *
   * @memberof AdobeStateStore
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
      requestUrl = new url.URL(`${this.endpoint}/v1/containers/${this.namespace}/${key}`)
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
   * Instantiates and returns a new AdobeStateStore object
   *
   * @static
   * @param {AdobeStateStoreCredentials} credentials the credential object
   * @returns {Promise<AdobeStateStore>} a new AdobeStateStore instance
   * @memberof AdobeStateStore
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
    logger.debug(`init AdobeStateStore with ${JSON.stringify(cloned, null, 2)}`)

    const validation = joi.object().label('adobe').keys({
      apikey: joi.string().required(),
      namespace: joi.string().required()
    }).required()
      .validate(credentials)
    if (validation.error) {
      logAndThrow(new codes.ERROR_BAD_ARGUMENT({
        messageValues: [validation.error.message],
        sdkDetails: cloned
      }))
    }

    return new AdobeStateStore(credentials.namespace, credentials.apikey)
  }

  /* **************************** ADOBE STATE STORE OPERATORS ***************************** */

  /**
   * Retrieves the state value for given key.
   * If the key doesn't exist returns undefined.
   *
   * @param {string} key state key identifier
   * @returns {Promise<AdobeStateStoreGetReturnValue>} get response holding value and additional info
   * @memberof AdobeStateStore
   */
  async get (key) {
    logger.debug(`get '${key}'`)
    return this._get(key)
  }

  /**
   * Creates or updates a state key-value pair
   *
   * @param {string} key state key identifier
   * @param {any} value state value
   * @param {AdobeStateStorePutOptions} [options={}] put options
   * @returns {Promise<string>} key
   * @memberof AdobeStateStore
   */
  async put (key, value, options = {}) {
    const { ttl } = options
    logger.debug(`put '${key}' with ttl ${ttl}`)
    return this._put(key, value, { ttl })
  }

  /**
   * Deletes a state key-value pair
   *
   * @param {string} key state key identifier
   * @returns {Promise<string>} key of deleted state or `null` if state does not exists
   * @memberof AdobeStateStore
   */
  async delete (key) {
    logger.debug(`delete '${key}'`)
    return this._delete(key)
  }

  /**
   * Deletes all key-values
   *
   * @returns {Promise<boolean>} true if deleted, false if not
   * @memberof StateStore
   */
  async deleteAll () {
    logger.debug('deleteAll')
    return this._deleteAll()
  }

  /**
   * There exists key-values.
   *
   * @returns {Promise<boolean>} true if exists, false if not
   * @memberof StateStore
   */
  async any () {
    logger.debug('any')
    return this._any()
  }

  /* **************************** PRIVATE METHODS TO IMPLEMENT ***************************** */

  /**
   * @param {string} key state key identifier
   * @returns {Promise<AdobeStateStoreGetReturnValue>} get response holding value and additional info
   * @protected
   */
  async _get (key) {
    const promise = this.fetchRetry.exponentialBackoff(this.createRequestUrl(key), {
      method: 'GET',
      headers: {
        ...this.getAuthorizationHeaders()
      }
    })
    const response = await _wrap(promise, { key })
    if (response) {
      return response.json()
    }
  }

  /**
   * @param {string} key state key identifier
   * @param {any} value state value
   * @param {object} options state put options
   * @returns {Promise<string>} key
   * @protected
   */
  async _put (key, value, options) {
    const { ttl } = options
    const promise = this.fetchRetry.exponentialBackoff(this.createRequestUrl(key, { ttl }), {
      method: 'PUT',
      headers: {
        ...this.getAuthorizationHeaders(),
        'Content-Type': 'application/octet-stream'
      },
      body: Readable.from(value)
    })
    await _wrap(promise, { key, value, ...options })
    return key
  }

  /**
   * @param {string} key state key identifier
   * @returns {Promise<string>} key of deleted state or `null` if state does not exists
   * @protected
   */
  async _delete (key) {
    const promise = this.fetchRetry.exponentialBackoff(this.createRequestUrl(key), {
      method: 'DELETE',
      headers: {
        ...this.getAuthorizationHeaders()
      }
    })
    const ret = await _wrap(promise, { key })
    return ret && key
  }

  /**
   * @returns {Promise<boolean>} true if deleted, false if not
   * @protected
   */
  async _deleteAll () {
    const promise = this.fetchRetry.exponentialBackoff(this.createRequestUrl(), {
      method: 'DELETE',
      headers: {
        ...this.getAuthorizationHeaders()
      }
    })
    const response = await _wrap(promise, {})
    return response !== null
  }

  /**
   * @returns {Promise<boolean>} true if exists, false if not
   * @protected
   */
  async _any () {
    const promise = this.fetchRetry.exponentialBackoff(this.createRequestUrl(), {
      method: 'HEAD',
      headers: {
        ...this.getAuthorizationHeaders()
      }
    })
    const response = await _wrap(promise, {})
    return response !== null
  }
}

module.exports = { AdobeStateStore }
