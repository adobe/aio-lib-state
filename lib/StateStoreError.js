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

const { ErrorWrapper, createUpdater } = require('@adobe/aio-lib-core-errors').CNACoreSDKErrorWrapper

// TODO find a better way to jsdoc error types
/**
 * @typedef StateLibError
 * @private
 *
 */
/**
 * State lib custom errors.
 *
 * `e.sdkDetails` provides additional context for each error (e.g. function parameter)
 *
 * @typedef StateLibErrors
 * @type {object}
 * @property {StateLibError} ERROR_BAD_ARGUMENT this error is thrown when an argument is missing or has invalid type
 * @property {StateLibError} ERROR_NOT_IMPLEMENTED this error is thrown when a method is not implemented or when calling
 * methods directly on the abstract class (StateStore).
 * @property {StateLibError} ERROR_PAYLOAD_TOO_LARGE this error is thrown when the state key, state value or underlying request payload size
 * exceeds the specified limitations.
 * @property {StateLibError} ERROR_BAD_CREDENTIALS this error is thrown when the supplied init credentials are invalid.
 * @property {StateLibError} ERROR_INTERNAL this error is thrown when an unknown error is thrown by the underlying
 * DB provider or TVM server for credential exchange. More details can be found in `e.sdkDetails._internal`.
 */

const codes = {}
const messages = new Map()

const Updater = createUpdater(
  codes,
  messages
)

const E = ErrorWrapper(
  'StateLibError',
  'TvmLib',
  Updater
)

E('ERROR_INTERNAL', '%s')
E('ERROR_BAD_ARGUMENT', '%s')
E('ERROR_NOT_IMPLEMENTED', 'method `%s` not implemented')
E('ERROR_BAD_CREDENTIALS', 'cannot access %s, make sure your credentials are valid')
E('ERROR_PAYLOAD_TOO_LARGE', 'key, value or request payload is too large')

module.exports = {
  codes,
  messages
}
