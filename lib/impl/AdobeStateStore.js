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
const { codes, logAndThrow } = require('./StateStoreError')
const joi = require('joi')
const utils = require('../utils')
const cloneDeep = require('lodash.clonedeep')
const logger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-state', { provider: 'debug' })
const { StateStore } = require('../StateStore')
// const { HttpExponentialBackoff } = require('@adobe/aio-lib-core-networking')
// const fetchRetry = new HttpExponentialBackoff()
const { getCliEnv, PROD_ENV, STAGE_ENV } = require('@adobe/aio-lib-env')

/* *********************************** typedefs *********************************** */

const ADOBE_STATE_STORE_ENDPOINT = {
  [PROD_ENV]: '???',
  [STAGE_ENV]: '???-stage'
}

/* *********************************** typedefs *********************************** */

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
function throwNotImplemented (methodName) {
  logAndThrow(new codes.ERROR_NOT_IMPLEMENTED({ messageValues: [methodName] }))
}

// eslint-disable-next-line jsdoc/require-jsdoc
function validateInput (input, schema, details) {
  const validation = schema.validate(input)
  if (validation.error) {
    logAndThrow(new codes.ERROR_BAD_ARGUMENT({
      messageValues: [validation.error.message],
      sdkDetails: cloneDeep(details)
    }))
  }
}

// eslint-disable-next-line jsdoc/require-jsdoc
function validateKey (key, details, label = 'key') {
  validateInput(key, joi.string().label(label).required().regex(/[?#/\\]/, { invert: true }).messages({
    'string.pattern.invert.base': 'Key cannot contain ?, #, /, or \\'
  }), details)
}

// eslint-disable-next-line jsdoc/require-jsdoc
function validateValue (value, details, label = 'value') {
  validateInput(value, joi.any().label(label), details) // make it .required() ?
}

/**
 * @abstract
 * @class AdobeStateStore
 * @classdesc Cloud State Management
 * @hideconstructor
 */
class AdobeStateStore extends StateStore {
  /* **************************** CONSTRUCTOR/INIT TO IMPLEMENT ***************************** */

  /**
   * Creates an instance of AdobeStateStore.
   *
   * @memberof AdobeStateStore
   * @private
   * @param {string} apikey the apikey for the Adobe State Store
   */
  constructor (apikey) {
    super()
    /** @private */
    this.apikey = apikey
    /** @private */
    this.endpoint = ADOBE_STATE_STORE_ENDPOINT[getCliEnv()]
  }

  /**
   * Instantiates and returns a new AdobeStateStore object
   *
   * @static
   * @param {object} credentials abstract credential object
   * @returns {Promise<AdobeStateStore>} a new AdobeStateStore instance
   * @memberof AdobeStateStore
   * @override
   * @private
   */
  static async init (credentials = {}) {
    // include ow environment vars to credentials
    if (!credentials.apikey) {
      credentials.apikey = process.env.__OW_API_KEY
    }

    const cloned = utils.withHiddenFields(credentials, ['apikey'])
    logger.debug(`init AdobeStateStore with ${JSON.stringify(cloned, null, 2)}`)

    const validation = joi.object().label('adobe').keys({
      apikey: joi.string()
    }).required()
      .validate(credentials)
    if (validation.error) {
      logAndThrow(new codes.ERROR_BAD_ARGUMENT({
        messageValues: [validation.error.message],
        sdkDetails: cloned
      }))
    }

    return new AdobeStateStore(credentials.apikey)
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
    validateKey(key, { key })
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
    const details = { key, value, options }
    validateKey(key, details)
    validateValue(value, details)
    validateInput(options, joi.object().label('options').keys({ ttl: joi.number() }).options({ convert: false }), details)

    const ttl = options.ttl || AdobeStateStore.DefaultTTL // => undefined, null, 0 sets to default
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
    validateKey(key, { key })
    logger.debug(`delete '${key}'`)
    return this._delete(key)
  }

  /* **************************** PRIVATE METHODS TO IMPLEMENT ***************************** */

  /**
   * @param {string} key state key identifier
   * @returns {Promise<AdobeStateStoreGetReturnValue>} get response holding value and additional info
   * @protected
   */
  async _get (key) {
    throwNotImplemented('_get')
  }

  /**
   * @param {string} key state key identifier
   * @param {any} value state value
   * @param {object} options state put options
   * @returns {Promise<string>} key
   * @protected
   */
  async _put (key, value, options) {
    throwNotImplemented('_put')
  }

  /**
   * @param {string} key state key identifier
   * @returns {Promise<string>} key of deleted state or `null` if state does not exists
   * @protected
   */
  async _delete (key) {
    throwNotImplemented('_delete')
  }
}

AdobeStateStore.DefaultTTL = 86400 // 24hours

module.exports = { AdobeStateStore }
