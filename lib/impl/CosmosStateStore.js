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

const joi = require('joi')
const cosmos = require('@azure/cosmos')
const cloneDeep = require('lodash.clonedeep')
const logger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-state', { provider: 'debug' })

const utils = require('../utils')
const { codes, logAndThrow } = require('../StateStoreError')
const { StateStore } = require('../StateStore')

// eslint-disable-next-line jsdoc/require-jsdoc
async function _wrap (promise, params) {
  let response
  try {
    response = await promise
  } catch (e) {
    const copyParams = cloneDeep(params)
    // error handling
    const status = e.statusCode || e.code
    if (status === 404) {
      return null
    }
    logger.debug(`got internal error with status ${status}: ${e.message} `)
    if (status === 403) {
      if (e.message.includes('blocked by your Cosmos DB account firewall settings')) {
        logAndThrow(new codes.ERROR_FIREWALL({ messageValues: ['underlying DB provider'], sdkDetails: copyParams }))
      }
      logAndThrow(new codes.ERROR_BAD_CREDENTIALS({ messageValues: ['underlying DB provider'], sdkDetails: copyParams }))
    }
    if (status === 413) {
      logAndThrow(new codes.ERROR_PAYLOAD_TOO_LARGE({ sdkDetails: copyParams }))
    }
    if (e.message.toLowerCase().includes('illegal')) {
      // e.message is is not as descriptive or consistent.
      const invalidChars = "The following characters are restricted and cannot be used in the Id property: '/', '\\', '?', '#' "
      logAndThrow(new codes.ERROR_BAD_REQUEST({ messageValues: [invalidChars], sdkDetails: copyParams }))
    }
    if (status === 429) {
      logAndThrow(new codes.ERROR_REQUEST_RATE_TOO_HIGH({ sdkDetails: copyParams }))
    }
    logAndThrow(new codes.ERROR_INTERNAL({ messageValues: [`unknown error response from provider with status: ${status || 'unknown'}`], sdkDetails: { ...copyParams, _internal: e } }))
  }
  // 404 does not throw in cosmos SDK which is fine as we treat 404 as a non-error,
  // here we just make sure there are no other cases of bad status codes that don't throw
  const status = response.statusCode
  if (status && status >= 300 && status !== 404) {
    logAndThrow(new codes.ERROR_INTERNAL({ messageValues: [`unexpected response from provider with status: ${status}`], sdkDetails: { ...cloneDeep(params), _internal: response } }))
  }
  return response
}

/**
 * @class CosmosStateStore
 * @classdesc Azure Cosmos state store implementation
 * @augments StateStore
 * @hideconstructor
 * @private
 */
class CosmosStateStore extends StateStore {
  /**
   * @memberof CosmosStateStore
   * @override
   * @private
   */
  constructor (container, partitionKey, /* istanbul ignore next */ options = { expiration: null }) {
    super()
    /** @private */
    this._cosmos = {}
    this._cosmos.container = container
    this._cosmos.partitionKey = partitionKey
    this.expiration = options.expiration
  }

  /**
   * @param {object} credentials azure cosmos credentials
   * @memberof CosmosStateStore
   * @override
   * @private
   */
  static async init (credentials) {
    const cloned = utils.withHiddenFields(credentials, ['masterKey', 'resourceToken'])
    logger.debug(`init CosmosStateStore with ${JSON.stringify(cloned, null, 2)}`)

    const validation = joi.object().label('cosmos').keys({
      // either
      resourceToken: joi.string(),
      // or
      masterKey: joi.string(),
      // for both
      endpoint: joi.string().required(),
      databaseId: joi.string().required(),
      containerId: joi.string().required(),
      partitionKey: joi.string().required(),

      expiration: joi.string() // allowed for tvm response, in ISO format
    }).xor('masterKey', 'resourceToken').required()
      .validate(credentials)
    if (validation.error) {
      logAndThrow(new codes.ERROR_BAD_ARGUMENT({
        messageValues: [validation.error.message],
        sdkDetails: cloned
      }))
    }

    const inMemoryInstance = CosmosStateStore.inMemoryInstance[credentials.partitionKey]
    if (inMemoryInstance && inMemoryInstance.expiration !== credentials.expiration) {
      // the TVM credentials have changed, aio-lib-core-tvm has generated new one likely because of expiration.
      delete CosmosStateStore.inMemoryInstance[credentials.partitionKey]
    }

    if (!CosmosStateStore.inMemoryInstance[credentials.partitionKey]) {
      let cosmosClient
      if (credentials.resourceToken) {
        // Note: resourceToken doesn't necessarily mean that the TVM provided the credentials, it can have been provided by a user.
        logger.debug('using azure cosmos resource token')
        cosmosClient = new cosmos.CosmosClient({ endpoint: credentials.endpoint, consistencyLevel: 'Session', tokenProvider: /* istanbul ignore next */ async () => credentials.resourceToken })
      } else {
        logger.debug('using azure cosmos master key')
        cosmosClient = new cosmos.CosmosClient({ endpoint: credentials.endpoint, consistencyLevel: 'Session', key: credentials.masterKey })
        // create if not exist creates 2 additional round trips on init -> should be enabled as an option
        // const { database } = await cosmosClient.databases.createIfNotExists({ id: credentials.databaseId })
        // container = (await database.containers.createIfNotExists({ id: credentials.containerId })).container
      }
      const container = cosmosClient.database(credentials.databaseId).container(credentials.containerId)
      CosmosStateStore.inMemoryInstance[credentials.partitionKey] = new CosmosStateStore(container, credentials.partitionKey, { expiration: credentials.expiration })
    } else {
      logger.debug('reusing exising in-memory CosmosClient initialization')
    }
    return CosmosStateStore.inMemoryInstance[credentials.partitionKey]
  }

  /**
   * @memberof CosmosStateStore
   * @override
   * @private
   */
  async _get (key) {
    const response = await _wrap(this._cosmos.container.item(key, this._cosmos.partitionKey).read(), { key })
    // if 404 response.resource = undefined
    if (!response.resource) return undefined
    if (response.resource.ttl < 0) {
      return { value: response.resource.value, expiration: null }
    }

    // azure ts and ttl in seconds, date takes ms
    const expiration = new Date(response.resource._ts * 1000 + response.resource.ttl * 1000).toISOString()
    return response.resource && { value: response.resource.value, expiration }
  }

  /**
   * @memberof CosmosStateStore
   * @override
   * @private
   */
  async _put (key, value, options) {
    const ttl = options.ttl < 0 ? -1 : options.ttl
    await _wrap(this._cosmos.container.items.upsert({ id: key, partitionKey: this._cosmos.partitionKey, ttl, value }), { key, value, options })
    return key
  }

  /**
   * @memberof CosmosStateStore
   * @override
   * @private
   */
  async _delete (key) {
    // if throws 404 wrap returns null
    const ret = await _wrap(this._cosmos.container.item(key, this._cosmos.partitionKey).delete(), { key })
    return ret && key
  }
}

CosmosStateStore.inMemoryInstance = {}
module.exports = { CosmosStateStore }
