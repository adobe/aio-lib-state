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
const { withHiddenFields } = require('../lib/utils')

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
