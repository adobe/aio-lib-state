/*
Copyright 2019 Adobe. All rights reserved.
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
const cloneDeep = require('lodash.clonedeep')
const logger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-state', { provider: 'debug' })

/* *********************************** typedefs *********************************** */

/**
 * StateStore put options
 *
 * @typedef StateStorePutOptions
 * @type {object}
 * @property {number} ttl time-to-live for key-value pair in seconds, defaults to 24 hours (86400s). Set to < 0 for no expiry. A
 * value of 0 sets default.
 */

/**
 * StateStore get return object
 *
 * @typedef StateStoreGetReturnValue
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
 * @class StateStore
 * @classdesc Cloud State Management
 * @hideconstructor
 */
class StateStore {
  /* **************************** CONSTRUCTOR/INIT TO IMPLEMENT ***************************** */

  /**
   * Creates an instance of StateStore.
   *
   * @param {boolean} _isTest set this to true to allow construction
   * @memberof StateStore
   * @private
   * @abstract
   */
  constructor (_isTest) { if (new.target === StateStore && !_isTest) throwNotImplemented('StateStore') }
  // marked as private to hide from jsdoc, wrapped by index.js init
  /**
   * Instantiates and returns a new StateStore object
   *
   * @static
   * @param {object} credentials abstract credential object
   * @returns {Promise<StateStore>} a new StateStore instance
   * @memberof StateStore
   * @private
   */
  static async init (credentials) { throwNotImplemented('init') }

  /* **************************** STATE STORE OPERATORS ***************************** */

  /**
   * Retrieves the state value for given key.
   * If the key doesn't exist returns undefined.
   *
   * @param {string} key state key identifier
   * @returns {Promise<StateStoreGetReturnValue>} get response holding value and additional info
   * @memberof StateStore
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
   * @param {StateStorePutOptions} [options={}] put options
   * @returns {Promise<string>} key
   * @memberof StateStore
   */
  async put (key, value, options = {}) {
    const details = { key, value, options }
    validateKey(key, details)
    validateValue(value, details)
    validateInput(options, joi.object().label('options').keys({ ttl: joi.number() }).options({ convert: false }), details)

    const ttl = options.ttl || StateStore.DefaultTTL // => undefined, null, 0 sets to default
    logger.debug(`put '${key}' with ttl ${ttl}`)
    return this._put(key, value, { ttl })
  }

  /**
   * Deletes a state key-value pair
   *
   * @param {string} key state key identifier
   * @returns {Promise<string>} key of deleted state or `null` if state does not exists
   * @memberof StateStore
   */
  async delete (key) {
    validateKey(key, { key })
    logger.debug(`delete '${key}'`)
    return this._delete(key)
  }

  /* **************************** PRIVATE METHODS TO IMPLEMENT ***************************** */
  /**
   * @param {string} key state key identifier
   * @returns {Promise<StateStoreGetReturnValue>} get response holding value and additional info
   * @protected
   */
  async _get (key) { throwNotImplemented('_get') }
  /**
   * @param {string} key state key identifier
   * @param {any} value state value
   * @param {object} options state put options
   * @returns {Promise<string>} key
   * @protected
   */
  async _put (key, value, options) { throwNotImplemented('_put') }
  /**
   * @param {string} key state key identifier
   * @returns {Promise<string>} key of deleted state or `null` if state does not exists
   * @protected
   */
  async _delete (key) { throwNotImplemented('_delete') }
}

StateStore.DefaultTTL = 86400 // 24hours

module.exports = { StateStore }
