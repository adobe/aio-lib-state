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
const { CosmosStateStore } = require('./lib/impl/CosmosStateStore')
const { StateStoreError } = require('./lib/StateStoreError')
const { StateStore } = require('./lib/StateStore')
const TvmClient = require('@adobe/adobeio-cna-tvm-client')

/**
 * Initializes and returns the key-value-store SDK.
 *
 * To use the SDK you must either provide your
 * [OpenWhisk credentials]{@link module:types~OpenWhiskCredentials} in
 * `credentials.ow` or your own
 * [Azure Cosmos credentials]{@link module:types~AzureCosmosMasterCredentials} in `credentials.cosmos`.
 *
 * OpenWhisk credentials can also be read from environment variables (`OW_NAMESPACE` or `__OW_NAMESPACE` and `OW_AUTH` or `__OW_AUTH`).
 *
 * @param {object} credentials used to init the sdk
 *
 * @param {module:types~OpenWhiskCredentials} [credentials.ow]
 * {@link module:types~OpenWhiskCredentials}. Set those if you want
 * to use ootb credentials to access the state management service. OpenWhisk
 * namespace and auth can also be passed through environment variables:
 * `__OW_NAMESPACE` and `__OW_AUTH`
 *
 * @param {module:types~AzureCosmosMasterCredentials|module:types~AzureCosmosPartitionResourceCredentials} [credentials.cosmos]
 * [Azure Cosmos resource credentials]{@link module:types~AzureCosmosPartitionResourceCredentials} or
 * [Azure Cosmos account credentials]{@link module:types~AzureCosmosMasterCredentials}
 *
 * @param {object} [options={}] options
 * @param {string} [options.tvmApiUrl] alternative tvm api url. Only applies in the context of OpenWhisk credentials.
 * @param {string} [options.tvmCacheFile] alternative tvm cache file, defaults
 * to `<tmpfolder>/.tvmCache`. Set to `false` to disable caching. Only applies in the context of OpenWhisk credentials.
 * @returns {Promise<StateStore>} A StateStore instance
 * @throws {StateStoreError}
 */
async function init (credentials, options) {
  // 1. set provider
  const provider = 'cosmos' // only cosmos is supported for now

  // 2. instantiate tvm if ow credentials
  let tvm
  if (!credentials.cosmos) { // credentials.ow can be empty if env vars are set
    // default tvm url
    const tvmArgs = { ow: credentials.ow, apiUrl: options.tvmApiUrl }
    if (options.tvmCacheFile) tvmArgs.cacheFile = options.tvmCacheFile
    tvm = await TvmClient.init(tvmArgs)
  }

  // 3. return state store based on provider
  switch (provider) {
    case 'cosmos':
      return CosmosStateStore.init(credentials.cosmos || (await tvm.getAzureCosmosCredentials()))
    // default:
    //   throw new StateStoreError(`provider '${provider}' is not supported.`, StateStoreError.codes.BadArgument)
  }
}

module.exports = { init }
