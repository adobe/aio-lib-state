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

const { CosmosKVS } = require('./lib/azure/CosmosKVS')
const { KVSError } = require('./lib/KVSError')
const { KVS } = require('./lib/KVS')
const TvmClient = require('@adobe/adobeio-cna-tvm-client')

/**
 * Initializes and returns the key-value-store SDK.
 *
 * To use the SDK you must either provide provide your
 * [OpenWhisk credentials]{@link module:types~OpenWhiskCredentials} in
 * `credentials.ow` or your own
 * [Azure storage credentials]{@link module:types~AzureCosmosMasterCredentials} in `credentials.azure`.
 *
 * OpenWhisk credentials can also be read from environment variables (`OW_NAMESPACE` or `__OW_NAMESPACE` and `OW_AUTH` or `__OW_AUTH`).
 *
 * @param {object} credentials used to init the sdk
 *
 * @param {module:types~OpenWhiskCredentials} [credentials.ow]
 * {@link module:types~OpenWhiskCredentials}. Set those if you want
 * to use ootb credentials to access our storage infrastructure. OpenWhisk
 * namespace and auth can also be passed through environment variables:
 * `OW_NAMESPACE` or `__OW_NAMESPACE` and `OW_AUTH` or `__OW_AUTH`
 *
 * @param {module:types~AzureCosmosMasterCredentials|module:types~AzureCosmosResourceCredentials} [credentials.azure]
 * bring your own [Azure SAS credentials]{@link module:types~AzureCosmosResourceCredentials} or
 * [Azure storage account credentials]{@link module:types~AzureCosmosMasterCredentials}
 *
 * @param {object} [options={}] options
 * @param {string} [options.tvmApiUrl] alternative tvm api url. Only makes
 * sense in the context of OpenWhisk credentials.
 * @param {string} [options.tvmCacheFile] alternative tvm cache file, defaults
 * to `<tmpfolder>/.tvmCache`. Set to `false` to disable caching. Only makes
 * sense in the context of OpenWhisk credentials.
 * @returns {Promise<KVS>} A storage instance
 * @throws {KVSError}
 */
async function init (credentials, options = {}) {
  // todo in tvm client?
  // include ow environment vars to credentials
  const namespace = process.env['__OW_NAMESPACE'] || process.env['OW_NAMESPACE']
  const auth = process.env['__OW_AUTH'] || process.env['OW_AUTH']
  if (namespace || auth) {
    if (typeof credentials !== 'object') {
      credentials = {}
    }
    if (typeof credentials.ow !== 'object') {
      credentials.ow = {}
    }
    credentials.ow.namespace = credentials.ow.namespace || namespace
    credentials.ow.auth = credentials.ow.auth || auth
  }

  return _init(credentials, options)
}

// eslint-disable-next-line jsdoc/require-jsdoc
async function _init (credentials, options) {
  const validation = joi.validate(credentials, joi.object().label('credentials').keys({
    azure: joi.object().keys({
      // either
      cosmosClientArgs: joi.object().label('cosmosClientArgs').keys({
        endpoint: joi.string().required(),
        resourceTokens: joi.object().required()
      }),
      // or
      cosmosMasterKey: joi.string(),
      cosmosAccount: joi.string(),
      // always
      databaseId: joi.string().required(),
      containerId: joi.string().required()
    }).unknown().and('cosmosMasterKey', 'cosmosAccount').xor('cosmosMasterKey', 'cosmosClientArgs'),
    ow: joi.object().keys({
      namespace: joi.string().required(),
      auth: joi.string().required()
    })
  }).unknown().xor('ow', 'azure').required())
  if (validation.error) throw new KVSError(validation.error.message, KVSError.codes.BadArgument)

  // 1. set provider
  const provider = 'azure' // only azure is supported for now

  // 2. instantiate tvm if ow credentials
  let tvm
  if (credentials.ow && !credentials.azure) {
    // default tvm url
    const tvmArgs = { ow: credentials.ow, apiUrl: options.tvmApiUrl || _defaultTvmApiUrl }
    if (options.tvmCacheFile) tvmArgs.cacheFile = options.tvmCacheFile
    tvm = new TvmClient(tvmArgs)
  }

  // 3. return storage based on provider
  switch (provider) {
    case 'azure':
      return CosmosKVS.init(credentials.azure || await tvm.getAzureCosmosCredentials())
    // default:
    //   throw new KVSError(`provider '${provider}' is not supported.`, KVSError.codes.BadArgument)
  }
}

module.exports = { init, _defaultTvmApiUrl }
