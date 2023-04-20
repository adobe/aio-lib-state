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

const TvmClient = require('@adobe/aio-lib-core-tvm')
const logger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-state', { provider: 'debug' })

const utils = require('./utils')
const { CosmosStateStore } = require('./impl/CosmosStateStore')
const { StateStore } = require('./StateStore')
const { codes, logAndThrow } = require('./StateStoreError')

/* *********************************** typedefs *********************************** */
/**
 * An object holding the OpenWhisk credentials
 *
 * @typedef OpenWhiskCredentials
 * @type {object}
 * @property {string} namespace user namespace
 * @property {string} auth auth key
 */

/**
 * An object holding the Azure Cosmos resource credentials with permissions on a single partition and container
 *
 * @typedef AzureCosmosPartitionResourceCredentials
 * @type {object}
 * @property {string} endpoint cosmosdb resource endpoint
 * @property {string} resourceToken cosmosdb resource token restricted to the partitionKey
 * @property {string} databaseId id for cosmosdb database
 * @property {string} containerId id for cosmosdb container within database
 * @property {string} partitionKey key for cosmosdb partition within container authorized by resource token
 */

/**
 * An object holding the Azure Cosmos account master key
 *
 * @typedef AzureCosmosMasterCredentials
 * @type {object}
 * @property {string} endpoint cosmosdb resource endpoint
 * @property {string} masterKey cosmosdb account masterKey
 * @property {string} databaseId id for cosmosdb database
 * @property {string} containerId id for cosmosdb container within database
 * @property {string} partitionKey key for cosmosdb partition where data will be stored
 */
/* *********************************** helpers & init() *********************************** */

// eslint-disable-next-line jsdoc/require-jsdoc
async function wrapTVMRequest (promise, params) {
  return promise
    .catch(e => {
      if (e.sdkDetails.status === 401 || e.sdkDetails.status === 403) {
        logAndThrow(new codes.ERROR_BAD_CREDENTIALS({ messageValues: ['TVM'], sdkDetails: e.sdkDetails }))
      }
      throw e // throw raw tvm error
    })
}
/**
 * Initializes and returns the key-value-store SDK.
 *
 * To use the SDK you must either provide your
 * [OpenWhisk credentials]{@link OpenWhiskCredentials} in
 * `config.ow` or your own
 * [Azure Cosmos credentials]{@link AzureCosmosMasterCredentials} in `config.cosmos`.
 *
 * OpenWhisk credentials can also be read from environment variables `__OW_NAMESPACE` and `__OW_API_KEY`.
 *
 * @param {object} [config={}] used to init the sdk
 * @param {OpenWhiskCredentials} [config.ow]
 * {@link OpenWhiskCredentials}. Set those if you want
 * to use ootb credentials to access the state management service. OpenWhisk
 * namespace and auth can also be passed through environment variables:
 * `__OW_NAMESPACE` and `__OW_API_KEY`
 * @param {AzureCosmosMasterCredentials|AzureCosmosPartitionResourceCredentials} [config.cosmos]
 * [Azure Cosmos resource credentials]{@link AzureCosmosPartitionResourceCredentials} or
 * [Azure Cosmos account credentials]{@link AzureCosmosMasterCredentials}
 * @param {object} [config.tvm] tvm configuration, applies only when passing OpenWhisk credentials
 * @param {string} [config.tvm.apiUrl] alternative tvm api url.
 * @param {string} [config.tvm.cacheFile] alternative tvm cache file, set to `false` to disable caching of temporary credentials.
 * @returns {Promise<StateStore>} A StateStore instance
 */
async function init (config = {}) {
  // 0. log
  const logConfig = utils.withHiddenFields(config, ['ow.auth', 'cosmos.resourceToken', 'cosmos.masterKey'])

  logger.debug(`init with config: ${JSON.stringify(logConfig, null, 2)}`)

  // 1. set provider
  const provider = 'cosmos' // only cosmos is supported for now

  // 2. instantiate tvm if ow credentials
  let tvm
  if (provider === 'cosmos' && !config.cosmos) {
    // remember config.ow can be empty if env vars are set
    const tvmArgs = { ow: config.ow, ...config.tvm }
    tvm = await TvmClient.init(tvmArgs)
  }

  // 3. return state store based on provider
  switch (provider) {
    case 'cosmos':
      if (config.cosmos) {
        logger.debug('init with user provided cosmosDB credentials')
        // Do not reuse cosmos client instances for BringYourOwn creds
        CosmosStateStore.inMemoryInstance = {}
        return CosmosStateStore.init(config.cosmos)
      }
      logger.debug('init with openwhisk credentials')
      return CosmosStateStore.init(await wrapTVMRequest(tvm.getAzureCosmosCredentials()))
    // default:
    //   throw new StateStoreError(`provider '${provider}' is not supported.`, StateStoreError.codes.BadArgument)
  }
}

module.exports = { init }
