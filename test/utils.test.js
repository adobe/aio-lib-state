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
const { withHiddenFields, isInternalToAdobeRuntime, formatAjvErrors } = require('../lib/utils')

describe('withHiddenFields', () => {
  test('no params', () => {
    expect(withHiddenFields()).toEqual(undefined)
  })

  test('object with undefined hidden fields', () => {
    expect(withHiddenFields({})).toEqual({})
  })

  test('object with non-array hidden fields', () => {
    expect(withHiddenFields({}, 123)).toEqual({})
  })

  test('object with no hidden fields', () => {
    expect(withHiddenFields({}, [])).toEqual({})
  })

  test('object with hidden fields', () => {
    const src = {
      foo: 'bar',
      cat: 'bat'
    }
    const target = {
      ...src,
      cat: '<hidden>'
    }

    expect(withHiddenFields(src, ['cat'])).toEqual(target)
  })
})

describe('isInternalToAdobeRuntime', () => {
  const env = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...env }
  })

  afterEach(() => {
    process.env = env
  })

  test('in runtime context', () => {
    process.env.__OW_CLOUD = 'aws'
    expect(isInternalToAdobeRuntime()).toBeTruthy()
  })

  test('not in runtime context', () => {
    process.env.__OW_CLOUD = undefined
    expect(isInternalToAdobeRuntime()).toBeFalsy()
  })

  test('in runtime context - endpoints should be internal', () => {
    process.env.__OW_CLOUD = 'aws'

    expect(isInternalToAdobeRuntime()).toBeTruthy()
    jest.isolateModules(() => {
      const constants = require('../lib/constants')
      expect(constants.ENDPOINTS.prod).toEqual(constants.ENDPOINT_PROD_INTERNAL)
      expect(constants.ENDPOINTS.stage).toEqual(constants.ENDPOINT_STAGE_INTERNAL)
    })
  })

  test('not in runtime context - endpoints should be public', () => {
    process.env.__OW_CLOUD = undefined

    expect(isInternalToAdobeRuntime()).toBeFalsy()
    jest.isolateModules(() => {
      const constants = require('../lib/constants')
      expect(constants.ENDPOINTS.prod).toEqual(constants.ENDPOINT_PROD)
      expect(constants.ENDPOINTS.stage).toEqual(constants.ENDPOINT_STAGE)
    })
  })

  test('in runtime context - endpoints should be internal (ensure order of tests does not matter)', () => {
    process.env.__OW_CLOUD = 'aws'

    expect(isInternalToAdobeRuntime()).toBeTruthy()
    jest.isolateModules(() => {
      const constants = require('../lib/constants')
      expect(constants.ENDPOINTS.prod).toEqual(constants.ENDPOINT_PROD_INTERNAL)
      expect(constants.ENDPOINTS.stage).toEqual(constants.ENDPOINT_STAGE_INTERNAL)
    })
  })
})

describe('formatAjvErrors', () => {
  test('unknown keyword', () => {
    const errors = [
      {
        instancePath: '/value',
        schemaPath: '#/properties/value/type',
        keyword: 'some-keyword',
        params: { type: 'string' },
        message: 'must be something'
      }
    ]
    const firstError = formatAjvErrors(errors)[0]
    expect(firstError).toMatch('WARNING: keyword \'some-keyword\' was not handled for formatting:')
  })

  test('required keyword', () => {
    const errors = [
      {
        instancePath: '\\',
        schemaPath: '#/required',
        keyword: 'required',
        params: {
          missingProperty: 'apikey'
        },
        message: 'must have required property \'apikey\''
      },
      {
        instancePath: '\\',
        schemaPath: '#/required',
        keyword: 'required',
        params: {
          missingProperty: 'namespace'
        },
        message: 'must have required property \'namespace\''
      }
    ]
    const allErrors = formatAjvErrors(errors)
    expect(allErrors.length).toEqual(1)
    expect(allErrors[0]).toMatch('must have required properties: apikey, namespace')
  })

  test('enum keyword', () => {
    const errors = [
      {
        instancePath: '/region',
        schemaPath: '#/properties/region/enum',
        keyword: 'enum',
        params: {
          allowedValues: [
            'amer',
            'apac',
            'emea'
          ]
        },
        message: 'must be equal to one of the allowed values'
      }
    ]
    expect(formatAjvErrors(errors)[0]).toMatch('/region must be equal to one of the allowed values: amer, apac, emea')
  })

  test('type keyword', () => {
    const errors = [
      {
        instancePath: '/value',
        schemaPath: '#/properties/value/type',
        keyword: 'type',
        params: { type: 'string' },
        message: 'must be string'
      }
    ]
    const firstError = formatAjvErrors(errors)[0]
    expect(firstError).toMatch('/value must be string')
  })
})
