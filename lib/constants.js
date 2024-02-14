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

// gets these values if the keys are set in the environment, if not it will use the defaults set
// omit the protocol (https)
const {
  ADOBE_STATE_STORE_ENDPOINT_PROD = 'storage-state-amer.app-builder.adp.adobe.io',
  ADOBE_STATE_STORE_ENDPOINT_STAGE = 'storage-state-amer.stg.app-builder.corp.adp.adobe.io',
  ADOBE_STATE_STORE_ENDPOINT_PROD_INTERNAL = 'storage-state-amer.app-builder.int.adp.adobe.io',
  ADOBE_STATE_STORE_ENDPOINT_STAGE_INTERNAL = 'storage-state-amer.stg.app-builder.int.adp.adobe.io',
  API_VERSION = 'v1beta1',
  ADOBE_STATE_STORE_REGIONS = [ // first region is the default region
    'amer',
    'apac',
    'emea'
  ]
} = process.env

const ADOBE_STATE_STORE_ENDPOINT = {
  [PROD_ENV]: isInternalToAdobeRuntime() ? ADOBE_STATE_STORE_ENDPOINT_PROD_INTERNAL : ADOBE_STATE_STORE_ENDPOINT_PROD,
  [STAGE_ENV]: isInternalToAdobeRuntime() ? ADOBE_STATE_STORE_ENDPOINT_STAGE_INTERNAL : ADOBE_STATE_STORE_ENDPOINT_STAGE
}

const MAX_KEY_SIZE = 1024 * 1 // 1KB
const MAX_TTL_SECONDS = 60 * 60 * 24 * 365 // 365 days
const HEADER_KEY_EXPIRES = 'x-key-expires-ms'

const REGEX_PATTERN_STORE_NAMESPACE = '^(development-)?([0-9]{3,10})-([a-z0-9]{1,20})(-([a-z0-9]{1,20}))?$'
// The regex for keys, allowed chars are alphanumerical with _ and -
const REGEX_PATTERN_STORE_KEY = `^[a-zA-Z0-9-_-]{1,${MAX_KEY_SIZE}}$`

module.exports = {
  ADOBE_STATE_STORE_REGIONS,
  ADOBE_STATE_STORE_ENDPOINT_PROD,
  ADOBE_STATE_STORE_ENDPOINT_STAGE,
  ADOBE_STATE_STORE_ENDPOINT_PROD_INTERNAL,
  ADOBE_STATE_STORE_ENDPOINT_STAGE_INTERNAL,
  API_VERSION,
  MAX_KEY_SIZE,
  MAX_TTL_SECONDS,
  REGEX_PATTERN_STORE_NAMESPACE,
  REGEX_PATTERN_STORE_KEY,
  ADOBE_STATE_STORE_ENDPOINT,
  HEADER_KEY_EXPIRES
}
