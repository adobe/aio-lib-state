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

/**
 * Checks whether this library is in the context of being called in Adobe Runtime.
 *
 * @private
 * @returns {boolean} returns true if in Adobe Runtime
 */
function isInternalToAdobeRuntime () {
  const { __OW_NAMESPACE, __OW_API_HOST, __OW_ACTIVATION_ID } = process.env
  return !!(__OW_NAMESPACE && __OW_API_HOST && __OW_ACTIVATION_ID)
}

/**
 * Format the AJV errors into human-readable strings.
 *
 * @param {Array<object>} errors the errors to format
 * @returns {Array<string>} the human readable error(s)
 */
function formatAjvErrors (errors) {
  // return JSON.stringify(errors, null, 2)
  console.log('errors', errors)

  const stringErrors = []

  // ///////////////////////////////////////////
  // 'required' errors
  // we collect all required property errors into one error string

  const requiredPropertyErrors = errors.filter((error) => {
    return (
      error.keyword === 'required' &&
      error.params?.missingProperty
    )
  })

  if (requiredPropertyErrors.length > 0) {
    stringErrors.push(`must have required properties: ${requiredPropertyErrors.map(error => error.params?.missingProperty).join(', ')}`)
  }

  // ///////////////////////////////////////////
  // 'enum' errors

  errors
    .filter((error) => error.keyword === 'enum' && error.params?.allowedValues)
    .forEach((error) =>
      stringErrors.push(`${error.instancePath} must be equal to one of the allowed values: ${error.params?.allowedValues.join(', ')}`)
    )

  // ///////////////////////////////////////////
  // 'type' errors

  errors
    .filter((error) => error.keyword === 'type')
    .forEach((error) =>
      stringErrors.push(`${error.instancePath} ${error.message}`)
    )

  // ///////////////////////////////////////////
  // 'pattern' errors

  errors
    .filter((error) => error.keyword === 'pattern')
    .forEach((error) =>
      stringErrors.push(`${error.instancePath} ${error.message}`)
    )

  return stringErrors
}

module.exports = {
  withHiddenFields,
  isInternalToAdobeRuntime,
  formatAjvErrors
}
