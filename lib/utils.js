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

const cloneDeep = require('lodash.clonedeep')

/**
 * Replaces any hidden field values with the string '<hidden>'
 *
 * @private
 * @param {object} sourceObj the object to needs fields hidden
 * @param {Array<string>} fieldsToHide the fields that need the value hidden
 * @returns {object} the source object but with the specified fields hidden
 */
function withHiddenFields (sourceObj, fieldsToHide) {
  if (!sourceObj || !Array.isArray(fieldsToHide)) {
    return sourceObj
  }

  const copyConfig = cloneDeep(sourceObj)
  fieldsToHide.forEach(f => {
    const keys = f.split('.')
    const lastKey = keys.slice(-1)[0]

    // keep last key
    const traverse = keys
      .slice(0, -1)
      .reduce((obj, k) => obj && obj[k], copyConfig)

    if (traverse && traverse[lastKey]) {
      traverse[lastKey] = '<hidden>'
    }
  })
  return copyConfig
}

module.exports = {
  withHiddenFields
}
