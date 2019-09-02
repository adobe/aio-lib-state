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

const joi = require('@hapi/joi')
const cosmos = require('@azure/cosmos')
const { StateStoreError } = require('../StateStoreError')
const { StateStore } = require('../StateStore')

// eslint-disable-next-line jsdoc/require-jsdoc
async function _wrap (promise, key) {
  let response
  try {
    response = await promise
  } catch (e) {
    // error handling
    const status = e.statusCode
    if (status === 403) throw new StateStoreError(`access forbidden, make sure your credentials are valid`, StateStoreError.codes.Forbidden)
    throw new StateStoreError(`unknown error response from provider with status ${status || 'unknown'}`, StateStoreError.codes.Internal, e)
  }
  // 404 does not throw in cosmos SDK which is fine as we treat 404 as a non-error,
  // here we just make sure there are no other cases of bad status codes that don't throw
  const status = response.statusCode
  if (status && status >= 300 && status !== 404) {
    // for now treat redirect as bad
    throw new StateStoreError(`bad status response from provider: ${status}`, StateStoreError.codes.Internal)
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
  constructor (container, partitionKey) {
    super()
    /** @private */
    this._cosmos = {}
    this._cosmos.container = container
    this._cosmos.partitionKey = partitionKey
  }

  /**
   * @memberof CosmosStateStore
   * @override
   * @private
   */
  static async init (credentials) {
    const validation = joi.validate(credentials, joi.object().label('credentials').keys({
      // either
      resourceToken: joi.string(),
      // or
      masterKey: joi.string(),
      // for both
      endpoint: joi.string().required(),
      databaseId: joi.string().required(),
      containerId: joi.string().required(),
      partitionKey: joi.string().required()
    }).unknown().xor('masterKey', 'resourceToken').required())
    if (validation.error) throw new StateStoreError(validation.error.message, StateStoreError.codes.BadArgument)

    let cosmosClient, container
    if (credentials.resourceToken) {
      cosmosClient = new cosmos.CosmosClient({ endpoint: credentials.endpoint, tokenProvider: async () => credentials.resourceToken })
    } else {
      cosmosClient = new cosmos.CosmosClient({ endpoint: credentials.endpoint, key: credentials.masterKey })
      // create if not exist creates 2 additional round trips on init -> should be enabled as an option
      // const { database } = await cosmosClient.databases.createIfNotExists({ id: credentials.databaseId })
      // container = (await database.containers.createIfNotExists({ id: credentials.containerId })).container
    }
    container = cosmosClient.database(credentials.databaseId).container(credentials.containerId)
    return new CosmosStateStore(container, credentials.partitionKey)
  }

  /**
   * @memberof CosmosStateStore
   * @override
   * @private
   */
  async _get (key) {
    const response = await _wrap(this._cosmos.container.item(key, this._cosmos.partitionKey).read(), key)
    // if 404 response.resource = undefined
    return response.resource && response.resource.value
  }

  /**
   * @memberof CosmosStateStore
   * @override
   * @private
   */
  async _put (key, value) {
    await _wrap(this._cosmos.container.items.upsert({ id: key, partitionKey: this._cosmos.partitionKey, value }))
    return key
  }

  /**
   * @memberof CosmosStateStore
   * @override
   * @private
   */
  async _delete (key) {
    await _wrap(this._cosmos.container.item(key, this._cosmos.partitionKey).delete(), key)
    return key
  }

  // /**
  //  * @memberof CosmosStateStore
  //  * @override
  //  * @private
  //  */
  // async _keys () {
  //   // TODO
  //   throw new StateStoreError('method not implemented', StateStoreError.codes.NotImplemented)
  // }
}

module.exports = { CosmosStateStore }
