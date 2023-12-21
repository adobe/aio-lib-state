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

const { PROD_ENV, STAGE_ENV } = require('@adobe/aio-lib-env')

const ADOBE_STATE_STORE_ENDPOINT = {
  [PROD_ENV]: 'http://localhost:8080', // TODO:
  [STAGE_ENV]: 'http://localhost-stage:8080' // TODO:
}

const MAX_KEY_SIZE = 1024 * 1 // 1KB
const MAX_TTL_SECONDS = 60 * 60 * 24 * 365 // 365 days

const REGEX_PATTERN_STORE_NAMESPACE = '^(development-)?([0-9]{3,10})-([a-z0-9]{1,20})(-([a-z0-9]{1,20}))?$'
// The regex for keys, allowed chars are alphanumerical with _ and -
const REGEX_PATTERN_STORE_KEY = `^[a-zA-Z0-9-_-]{1,${MAX_KEY_SIZE}}$`

module.exports = {
  MAX_KEY_SIZE,
  MAX_TTL_SECONDS,
  REGEX_PATTERN_STORE_NAMESPACE,
  REGEX_PATTERN_STORE_KEY,
  ADOBE_STATE_STORE_ENDPOINT
}
