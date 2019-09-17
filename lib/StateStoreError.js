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

const codes = {}
const messages = new Map()

const Updater = createUpdater(
  codes,
  messages
)

const E = ErrorWrapper(
  'StateLibError',
  'StateLib',
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
