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

const { ErrorWrapper, createUpdater } = require('@adobe/aio-lib-core-errors').AioCoreSDKErrorWrapper
const logger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-state', { provider: 'debug' })

/**
 * @typedef {object} AdobeStateLibError
 * @property {string} message The message for the Error
 * @property {string} code The code for the Error
 * @property {string} sdk The SDK associated with the Error
 * @property {object} sdkDetails The SDK details associated with the Error
 */

/**
 * Adobe State lib custom errors.
 * `e.sdkDetails` provides additional context for each error (e.g. function parameter)
 *
 * @typedef StateLibErrors
 * @type {object}
 * @property {AdobeStateLibError} ERROR_BAD_ARGUMENT this error is thrown when an argument is missing, has invalid type, or includes invalid characters.
 * @property {AdobeStateLibError} ERROR_BAD_REQUEST this error is thrown when an argument has an illegal value.
 * @property {AdobeStateLibError} ERROR_NOT_IMPLEMENTED this error is thrown when a method is not implemented or when calling
 * methods directly on the abstract class (StateStore).
 * @property {AdobeStateLibError} ERROR_PAYLOAD_TOO_LARGE this error is thrown when the state key, state value or underlying request payload size
 * exceeds the specified limitations.
 * @property {AdobeStateLibError} ERROR_BAD_CREDENTIALS this error is thrown when the supplied init credentials are invalid.
 * @property {AdobeStateLibError} ERROR_UNAUTHORIZED this error is thrown when the credentials are unauthorized to access the resource
 * @property {AdobeStateLibError} ERROR_INTERNAL this error is thrown when an unknown error is thrown by the underlying
 * DB provider or TVM server for credential exchange. More details can be found in `e.sdkDetails._internal`.
 * @property {AdobeStateLibError} ERROR_REQUEST_RATE_TOO_HIGH this error is thrown when the request rate for accessing state is too high.
 */

const codes = {}
const messages = new Map()

const Updater = createUpdater(
  codes,
  messages
)

const E = ErrorWrapper(
  'AdobeStateLibError',
  'AdobeStateLib',
  Updater
)

E('ERROR_INTERNAL', '%s')
E('ERROR_BAD_REQUEST', '%s')
E('ERROR_BAD_ARGUMENT', '%s')
E('ERROR_UNKNOWN_PROVIDER', '%s')
E('ERROR_NOT_IMPLEMENTED', 'method `%s` not implemented')
E('ERROR_UNAUTHORIZED', 'you are not authorized to access %s')
E('ERROR_BAD_CREDENTIALS', 'cannot access %s, make sure your credentials are valid')
E('ERROR_PAYLOAD_TOO_LARGE', 'key, value or request payload is too large')
E('ERROR_REQUEST_RATE_TOO_HIGH', 'Request rate too high. Please retry after sometime.')
E('ERROR_FIREWALL', 'cannot access %s because your IP is blocked by a firewall, please make sure to run in an Adobe I/O Runtime action')

// eslint-disable-next-line jsdoc/require-jsdoc
function logAndThrow (e) {
  logger.error(JSON.stringify(e, null, 2))
  throw e
}

module.exports = {
  codes,
  messages,
  logAndThrow
}
