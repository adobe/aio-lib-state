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

/* ************* NOTE 1: these tests must be run sequentially, jest does it by default within a SINGLE file ************* */
/* ************* NOTE 2: requires env vars TEST_AUTH_1, TEST_NS_1 and TEST_AUTH_2, TEST_NS_2 for 2 different namespaces. ************* */

const stateLib = require('../index')
const { codes } = require('../lib/StateStoreError')

const testKey = 'e2e_test_state_key'

jest.setTimeout(30000) // thirty seconds per test

beforeEach(() => {
  expect.hasAssertions()
})

const initStateEnv = async (n = 1) => {
  delete process.env.__OW_API_KEY
  delete process.env.__OW_NAMESPACE
  process.env.__OW_API_KEY = process.env[`TEST_AUTH_${n}`]
  process.env.__OW_NAMESPACE = process.env[`TEST_NAMESPACE_${n}`]
  // 1. init will fetch credentials from the tvm using ow creds
  const state = await stateLib.init() // { tvm: { cacheFile: false } } // keep cache for better perf?
  // make sure we delete the testKey, note that delete might fail as it is an op under test
  await state.delete(testKey)
  return state
}

const waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms))

describe('e2e tests using OpenWhisk credentials (as env vars)', () => {
  test('error bad credentials test: auth is ok but namespace is not', async () => {
    delete process.env.__OW_API_KEY
    delete process.env.__OW_NAMESPACE
    process.env.__OW_API_KEY = process.env.TEST_AUTH_1
    process.env.__OW_NAMESPACE = process.env.TEST_NAMESPACE_1 + 'bad'

    try {
      await stateLib.init()
    } catch (e) {
      expect({ name: e.name, code: e.code, message: e.message, sdkDetails: e.sdkDetails }).toEqual(expect.objectContaining({
        name: 'StateLibError',
        code: 'ERROR_BAD_CREDENTIALS'
      }))
    }
  })

  test('key-value basic test on one key with string value: get, write, get, delete, get', async () => {
    const state = await initStateEnv()

    const testValue = 'a string'

    expect(await state.get(testKey)).toEqual(undefined)
    expect(await state.put(testKey, testValue)).toEqual(testKey)
    expect(await state.get(testKey)).toEqual(expect.objectContaining({ value: testValue }))
    expect(await state.delete(testKey, testValue)).toEqual(testKey)
    expect(await state.get(testKey)).toEqual(undefined)
  })

  test('key-value basic test on one key with object value: get, write, get, delete, get', async () => {
    const state = await initStateEnv()

    const testValue = { a: 'fake', object: { with: { multiple: 'layers' }, that: { dreams: { of: { being: 'real' } } } } }

    expect(await state.get(testKey)).toEqual(undefined)
    expect(await state.put(testKey, testValue)).toEqual(testKey)
    expect(await state.get(testKey)).toEqual(expect.objectContaining({ value: testValue }))
    expect(await state.delete(testKey, testValue)).toEqual(testKey)
    expect(await state.get(testKey)).toEqual(undefined)
  })

  test('time-to-live tests: write w/o ttl, get default ttl, write with ttl, get, get after ttl', async () => {
    const state = await initStateEnv()

    const testValue = { an: 'object' }

    // 1. test default ttl = 1 day
    expect(await state.put(testKey, testValue)).toEqual(testKey)
    let res = await state.get(testKey)
    expect(new Date(res.expiration).getTime()).toBeLessThanOrEqual(new Date(Date.now() + 86400000).getTime()) // 86400000 ms = 1 day
    expect(new Date(res.expiration).getTime()).toBeGreaterThanOrEqual(new Date(Date.now() + 86400000 - 10000).getTime()) // give more or less 10 seconds clock skew + request time

    // 2. test infinite ttl
    expect(await state.put(testKey, testValue, { ttl: -1 })).toEqual(testKey)
    expect(await state.get(testKey)).toEqual(expect.objectContaining({ expiration: null }))

    // 3. test that after ttl object is deleted
    expect(await state.put(testKey, testValue, { ttl: 2 })).toEqual(testKey)
    res = await state.get(testKey)
    expect(new Date(res.expiration).getTime()).toBeLessThanOrEqual(new Date(Date.now() + 2000).getTime())
    await waitFor(3000) // give it one more sec - azure ttl is not so precise
    expect(await state.get(testKey)).toEqual(undefined)
  })

  test('throw error when get/put with invalid keys', async () => {
    const invalidChars = "The following characters are restricted and cannot be used in the Id property: '/', '\\', '?', '#' "
    const invalidKey = 'invalid/key'
    const state = await initStateEnv()
    await expect(state.put(invalidKey, 'testValue')).rejects.toThrow(new codes.ERROR_BAD_REQUEST({
      messageValues: [invalidChars]
    }))
    await expect(state.get(invalidKey)).rejects.toThrow(new codes.ERROR_BAD_REQUEST({
      messageValues: [invalidChars]
    }))
  })

  test('isolation tests: get, write, delete on same key for two namespaces do not interfere', async () => {
    const state1 = await initStateEnv(1)
    const state2 = await initStateEnv(2)

    const testValue1 = { an: 'object' }
    const testValue2 = { another: 'dummy' }

    // 1. test that ns2 cannot get state in ns1
    await state1.put(testKey, testValue1)
    expect(await state2.get(testKey)).toEqual(undefined)

    // 2. test that ns2 cannot update state in ns1
    await state2.put(testKey, testValue2)
    expect(await state1.get(testKey)).toEqual(expect.objectContaining({ value: testValue1 }))

    // 3. test that ns1 cannot delete state in ns2
    await state1.delete(testKey)
    expect(await state2.get(testKey)).toEqual(expect.objectContaining({ value: testValue2 }))

    // cleanup delete ns2 state
    await state2.delete(testKey)
  })

  test('error value bigger than 2MB test', async () => {
    const state = await initStateEnv()

    const bigValue = ('a').repeat(1024 * 1024 * 2 + 1)

    try {
      await state.put(testKey, bigValue)
    } catch (e) {
      expect({ name: e.name, code: e.code, message: e.message, sdkDetails: e.sdkDetails }).toEqual(expect.objectContaining({
        name: 'StateLibError',
        code: 'ERROR_PAYLOAD_TOO_LARGE'
      }))
    }
  })
})
