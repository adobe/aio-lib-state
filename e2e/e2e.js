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

const path = require('node:path')

// load .env values in the e2e folder, if any
require('dotenv').config({ path: path.join(__dirname, '.env') })

const { MAX_TTL_SECONDS } = require('../lib/constants')
const stateLib = require('../index')

const testKey = 'e2e_test_state_key'
const testKey2 = 'e2e_test_state_key2'

jest.setTimeout(30000) // thirty seconds per test

const initStateEnv = async (n = 1) => {
  delete process.env.__OW_API_KEY
  delete process.env.__OW_NAMESPACE
  process.env.__OW_API_KEY = process.env[`TEST_AUTH_${n}`]
  process.env.__OW_NAMESPACE = process.env[`TEST_NAMESPACE_${n}`]
  const state = await stateLib.init()
  // make sure we cleanup the namespace, note that delete might fail as it is an op under test
  await state.deleteAll()
  return state
}

const waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms))

test('env vars', () => {
  expect(process.env.TEST_AUTH_1).toBeDefined()
  expect(process.env.TEST_AUTH_2).toBeDefined()
  expect(process.env.TEST_NAMESPACE_1).toBeDefined()
  expect(process.env.TEST_NAMESPACE_2).toBeDefined()
})

describe('e2e tests using OpenWhisk credentials (as env vars)', () => {
  test('error bad credentials test: auth is ok but namespace is not', async () => {
    delete process.env.__OW_API_KEY
    delete process.env.__OW_NAMESPACE
    process.env.__OW_API_KEY = process.env.TEST_AUTH_1
    process.env.__OW_NAMESPACE = process.env.TEST_NAMESPACE_1 + 'bad'
    let expectedError

    try {
      const store = await stateLib.init()
      await store.get('something')
    } catch (e) {
      expectedError = e
    }

    expect(expectedError).toBeDefined()
    expect(expectedError instanceof Error).toBeTruthy()
    expect({ name: expectedError.name, code: expectedError.code, message: expectedError.message, sdkDetails: expectedError.sdkDetails })
      .toEqual(expect.objectContaining({
        name: 'AdobeStateLibError',
        code: 'ERROR_BAD_CREDENTIALS'
      }))
  })

  test('key-value basic test on one key with string value: put, get, delete, any, stats, deleteAll', async () => {
    const state = await initStateEnv()

    const testValue = 'a string'

    expect(await state.get(testKey)).toEqual(undefined)
    expect(await state.put(testKey, testValue)).toEqual(testKey)
    expect(await state.get(testKey)).toEqual(expect.objectContaining({ value: testValue, expiration: expect.any(String) }))
    expect(await state.delete(testKey)).toEqual(testKey)
    expect(await state.get(testKey)).toEqual(undefined)
    expect(await state.any()).toEqual(false)
    expect(await state.put(testKey, testValue)).toEqual(testKey)
    expect(await state.put(testKey2, testValue)).toEqual(testKey2)
    expect(await state.any()).toEqual(true)
    expect(await state.stats()).toEqual({ bytesKeys: testKey.length + testKey2.length, bytesValues: testValue.length * 2, keys: 2 })
    expect(await state.deleteAll()).toEqual(true)
    expect(await state.get(testKey)).toEqual(undefined)
    expect(await state.any()).toEqual(false)
    expect(await state.stats()).toEqual(false)
  })

  test('time-to-live tests: write w/o ttl, get default ttl, write with ttl, get, get after ttl', async () => {
    const state = await initStateEnv()

    const testValue = 'test value'
    let res, resTime

    // 1. test default ttl = 1 day
    expect(await state.put(testKey, testValue)).toEqual(testKey)
    res = await state.get(testKey)
    resTime = new Date(res.expiration).getTime()
    expect(resTime).toBeLessThanOrEqual(new Date(Date.now() + 86400000).getTime()) // 86400000 ms = 1 day
    expect(resTime).toBeGreaterThanOrEqual(new Date(Date.now() + 86400000 - 10000).getTime()) // give more or less 10 seconds clock skew + request time

    // 2. test ttl = 0 (should default to default ttl of 1 day)
    expect(await state.put(testKey, testValue, { ttl: 0 })).toEqual(testKey)
    res = await state.get(testKey)
    resTime = new Date(res.expiration).getTime()
    expect(resTime).toBeLessThanOrEqual(new Date(Date.now() + 86400000).getTime()) // 86400000 ms = 1 day
    expect(resTime).toBeGreaterThanOrEqual(new Date(Date.now() + 86400000 - 10000).getTime()) // give more or less 10 seconds clock skew + request time

    // 3. test max ttl
    const nowPlus365Days = new Date(MAX_TTL_SECONDS).getTime()
    expect(await state.put(testKey, testValue, { ttl: -1 })).toEqual(testKey)
    res = await state.get(testKey)
    resTime = new Date(res.expiration).getTime()
    expect(resTime).toBeGreaterThanOrEqual(nowPlus365Days)

    // 4. test that after ttl object is deleted
    expect(await state.put(testKey, testValue, { ttl: 2 })).toEqual(testKey)
    res = await state.get(testKey)
    expect(new Date(res.expiration).getTime()).toBeLessThanOrEqual(new Date(Date.now() + 2000).getTime())
    await waitFor(3000) // give it one more sec - ttl is not so precise
    expect(await state.get(testKey)).toEqual(undefined)
  })

  test('listKeys test: few < 128 keys, many, and expired entries', async () => {
    const state = await initStateEnv()
    await state.deleteAll() // cleanup

    const genKeyStrings = (n) => {
      return (new Array(n).fill(0).map((_, idx) => {
        const char = String.fromCharCode(97 + idx % 26)
        // list-[a-z]-[0-(N-1)]
        return `list-${char}-${idx}`
      }))
    }
    const putKeys = async (keys, ttl) => {
      const _putKeys = async (keys, ttl) => {
        await Promise.all(keys.map(async (k, idx) => await state.put(k, `value-${idx}`, { ttl })))
      }

      const batchSize = 20
      let i = 0
      while (i < keys.length - batchSize) {
        await _putKeys(keys.slice(i, i + batchSize), ttl)
        i += batchSize
      }
      // final call
      await _putKeys(keys.slice(i), ttl)
    }

    // 1. test with not many elements, one iteration should return all
    const keys90 = genKeyStrings(90).sort()
    await putKeys(keys90, 60)

    let it = state.list()
    let ret = await it.next()
    expect(ret.value.keys.sort()).toEqual(keys90)
    expect(await it.next()).toEqual({ done: true, value: undefined })

    it = state.list({ match: 'list-*' })
    ret = await it.next()
    expect(ret.value.keys.sort()).toEqual(keys90)
    expect(await it.next()).toEqual({ done: true, value: undefined })

    it = state.list({ match: 'list-a*' })
    ret = await it.next()
    expect(ret.value.keys.sort()).toEqual(['list-a-0', 'list-a-26', 'list-a-52', 'list-a-78'])
    expect(await it.next()).toEqual({ done: true, value: undefined })

    it = state.list({ match: 'list-*-1' })
    ret = await it.next()
    expect(ret.value.keys.sort()).toEqual(['list-b-1'])
    expect(await it.next()).toEqual({ done: true, value: undefined })

    // 2. test with many elements and large countHint
    const keys900 = genKeyStrings(900)
    await putKeys(keys900, 60)

    it = state.list({ countHint: 1000 })
    ret = await it.next()
    expect(ret.value.keys.length).toEqual(900)
    expect(await it.next()).toEqual({ done: true, value: undefined })

    it = state.list({ countHint: 1000, match: 'list-*' })
    ret = await it.next()
    expect(ret.value.keys.length).toEqual(900)
    expect(await it.next()).toEqual({ done: true, value: undefined })

    it = state.list({ countHint: 1000, match: 'list-z*' })
    ret = await it.next()
    expect(ret.value.keys.length).toEqual(34)
    expect(await it.next()).toEqual({ done: true, value: undefined })

    it = state.list({ match: 'list-*-1' })
    ret = await it.next()
    expect(ret.value.keys.sort()).toEqual(['list-b-1'])
    expect(await it.next()).toEqual({ done: true, value: undefined })

    // 3. test with many elements while iterating
    let iterations = 0
    let retArray = []
    for await (const { keys } of state.list()) {
      iterations++
      retArray.push(...keys)
    }
    expect(iterations).toBeGreaterThan(5) // should be around 9-10
    expect(retArray.length).toEqual(900)

    iterations = 0
    retArray = []
    for await (const { keys } of state.list({ match: 'list-*' })) {
      iterations++
      retArray.push(...keys)
    }
    expect(iterations).toBeGreaterThan(5) // should be around 9-10
    expect(retArray.length).toEqual(900)

    iterations = 0
    retArray = []
    for await (const { keys } of state.list({ match: 'list-z*' })) {
      iterations++
      retArray.push(...keys)
    }
    expect(iterations).toEqual(1)
    expect(retArray.length).toEqual(34)

    iterations = 0
    retArray = []
    for await (const { keys } of state.list({ match: 'list-*-1' })) {
      iterations++
      retArray.push(...keys)
    }
    expect(iterations).toEqual(1)
    expect(retArray.length).toEqual(1)

    // 4. make sure expired keys aren't listed
    await putKeys(keys90, 1)
    await waitFor(2000)

    it = state.list({ countHint: 1000 })
    ret = await it.next()
    expect(ret.value.keys.length).toEqual(810) // 900 - 90
    expect(await it.next()).toEqual({ done: true, value: undefined })

    await state.deleteAll()
  })

  test('throw error when get/put with invalid keys', async () => {
    const invalidKey = 'some/invalid:key'
    const state = await initStateEnv()
    await expect(state.put(invalidKey, 'testValue')).rejects.toThrow('[AdobeStateLib:ERROR_BAD_ARGUMENT] /key must match pattern "^[a-zA-Z0-9-_.]{1,1024}$"')
    await expect(state.get(invalidKey)).rejects.toThrow('[AdobeStateLib:ERROR_BAD_ARGUMENT] /key must match pattern "^[a-zA-Z0-9-_.]{1,1024}$"')
  })

  test('isolation tests: get, write, delete on same key for two namespaces do not interfere', async () => {
    const state1 = await initStateEnv(1)
    const state2 = await initStateEnv(2)

    const testValue1 = 'one value'
    const testValue2 = 'some other value'

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

  test('error value bigger than 1MB test', async () => {
    const state = await initStateEnv()
    const bigValue = ('a').repeat(1024 * 1024 + 1)
    let expectedError

    try {
      await state.put(testKey, bigValue)
    } catch (e) {
      expectedError = e
    }

    expect(expectedError).toBeDefined()
    expect(expectedError instanceof Error).toBeTruthy()
    expect({ name: expectedError.name, code: expectedError.code, message: expectedError.message, sdkDetails: expectedError.sdkDetails })
      .toEqual(expect.objectContaining({
        name: 'AdobeStateLibError',
        code: 'ERROR_PAYLOAD_TOO_LARGE'
      }))
  })
})
