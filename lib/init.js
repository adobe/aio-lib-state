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

const logger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-state', { provider: 'debug' })

const utils = require('./utils')
const { AdobeStateStore } = require('./AdobeStateStore')

/* *********************************** typedefs *********************************** */
/**
 * An object holding the OpenWhisk credentials
 *
 * @typedef OpenWhiskCredentials
 * @type {object}
 * @property {string} namespace user namespace
 * @property {string} auth auth key
 */

/* *********************************** helpers & init() *********************************** */

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
 * @returns {Promise<AdobeStateStore>} An AdobeStateStore instance
 */
async function init (config = {}) {
  const logConfig = utils.withHiddenFields(config, ['ow.auth'])

  logger.debug(`init with config: ${JSON.stringify(logConfig, null, 2)}`)

  const { auth: apikey, namespace } = (config.ow ?? {})
  return AdobeStateStore.init({ apikey, namespace })
}

module.exports = { init }
