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

const { PROD_ENV, STAGE_ENV } = require('@adobe/aio-lib-env')
const { isInternalToAdobeRuntime } = require('./utils')

// Default endpoints with protocol
// the endpoints must have the region encoded as '-<region>'
const ENDPOINT_PROD = 'https://storage-state-<region>.app-builder.adp.adobe.io'
const ENDPOINT_PROD_INTERNAL = 'https://storage-state-<region>.app-builder.int.adp.adobe.io'
/// we always use the stage public endpoint, as Runtime Prod doesn't have access to State Stage internal
/// see https://jira.corp.adobe.com/browse/ACNA-2699
const ENDPOINT_STAGE = 'https://storage-state-<region>.stg.app-builder.adp.adobe.io'
const ENDPOINT_STAGE_INTERNAL = 'https://storage-state-<region>.stg.app-builder.adp.adobe.io'

const ALLOWED_REGIONS = [ // first region is the default region
  'amer',
  'emea'
  // soon to come: 'apac'
]

// can be overwritten by env
const {
  // needs protocol
  AIO_STATE_ENDPOINT: CUSTOM_ENDPOINT = null // make sure users can point to any instance (e.g. for testing)
} = process.env

const ENDPOINTS = {
  [PROD_ENV]: isInternalToAdobeRuntime() ? ENDPOINT_PROD_INTERNAL : ENDPOINT_PROD,
  [STAGE_ENV]: isInternalToAdobeRuntime() ? ENDPOINT_STAGE_INTERNAL : ENDPOINT_STAGE
}

const MAX_KEY_SIZE = 1024 * 1 // 1KB
const MAX_TTL_SECONDS = 60 * 60 * 24 * 365 // 365 days
const HEADER_KEY_EXPIRES = 'x-key-expires-ms'

const REGEX_PATTERN_STORE_NAMESPACE = '^(development-)?([0-9]{3,10})-([a-z0-9]{1,20})(-([a-z0-9]{1,20}))?$'
// The regex for keys, allowed chars are alphanumerical with _ - .
const REGEX_PATTERN_STORE_KEY = `^[a-zA-Z0-9-_.]{1,${MAX_KEY_SIZE}}$`
// Same as REGEX_PATTERN_STORE_KEY with an added * to support glob-style matching
const REGEX_PATTERN_MATCH_KEY = `^[a-zA-Z0-9-_.*]{1,${MAX_KEY_SIZE}}$`
const MAX_LIST_COUNT_HINT = 1000
const MIN_LIST_COUNT_HINT = 100

const REQUEST_ID_HEADER = 'x-request-id'

module.exports = {
  ALLOWED_REGIONS,
  ENDPOINTS,
  CUSTOM_ENDPOINT,
  MAX_KEY_SIZE,
  MAX_TTL_SECONDS,
  REGEX_PATTERN_STORE_NAMESPACE,
  REGEX_PATTERN_STORE_KEY,
  HEADER_KEY_EXPIRES,
  REGEX_PATTERN_MATCH_KEY,
  MAX_LIST_COUNT_HINT,
  MIN_LIST_COUNT_HINT,
  REQUEST_ID_HEADER,
  // for testing only
  ENDPOINT_PROD,
  ENDPOINT_PROD_INTERNAL,
  ENDPOINT_STAGE,
  ENDPOINT_STAGE_INTERNAL
}
