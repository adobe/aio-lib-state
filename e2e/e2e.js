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

/* ************* NOTE 1: these tests must be run sequentially, using --runInBand ************* */
/* ************* NOTE 2: requires env vars TEST_AUTH_1, TEST_NS_1 and TEST_AUTH_2, TEST_NS_2 for 2 different namespaces. ************* */

const path = require('node:path')

// load .env values in the e2e folder, if any
require('dotenv').config({ path: path.join(__dirname, '.env') })

const { MAX_TTL_SECONDS } = require('../lib/constants')
const stateLib = require('../index')
const { randomInt } = require('node:crypto')

const uniquePrefix = `${Date.now()}.${randomInt(10)}`
const testKey = `${uniquePrefix}__e2e_test_state_key`
const testKey2 = `${uniquePrefix}__e2e_test_state_key2`

jest.setTimeout(60000) // 1 minute per test

const initStateEnv = async (n = 1) => {
  delete process.env.__OW_API_KEY
  delete process.env.__OW_NAMESPACE
  process.env.__OW_API_KEY = process.env[`TEST_AUTH_${n}`]
  process.env.__OW_NAMESPACE = process.env[`TEST_NAMESPACE_${n}`]
  const state = await stateLib.init()
  // // make sure we cleanup the namespace, note that delete might fail as it is an op under test
  // await state.delete(`${uniquePrefix}*`)
  await state.delete(testKey)
  await state.delete(testKey2)
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

  test('key-value basic test on one key with string value: put, get, delete, any, stats', async () => {
    const state = await initStateEnv()

    const testValue = 'a string'
    const testValue2 = 'a longer string'

    expect(await state.get(testKey)).toEqual(undefined)
    expect(await state.put(testKey, testValue)).toEqual(testKey)
    expect(await state.get(testKey)).toEqual(expect.objectContaining({ value: testValue, expiration: expect.any(String) }))

    expect(await state.any()).toEqual(true)
    const stats = await state.stats()
    expect(stats).toBeDefined()
    expect(stats.keys).toBeGreaterThanOrEqual(1)
    expect(stats.bytesKeys).toBeGreaterThanOrEqual(testKey.length)
    expect(stats.bytesValues).toBeGreaterThanOrEqual(testValue.length)

    expect(await state.put(testKey2, testValue2)).toEqual(testKey2)

    expect(await state.any()).toEqual(true)
    const stats2 = await state.stats()
    expect(stats2).toBeDefined()
    expect(stats2.keys).toBeGreaterThanOrEqual(2)
    expect(stats2.bytesKeys).toBeGreaterThanOrEqual(testKey.length + testKey2.length)
    expect(stats2.bytesValues).toBeGreaterThanOrEqual(testValue.length + testValue2.length)

    expect(await state.delete(testKey)).toEqual(testKey)
    expect(await state.get(testKey)).toEqual(undefined)
    expect(await state.delete(testKey2)).toEqual(testKey2)
    expect(await state.get(testKey2)).toEqual(undefined)

    // note we can't test any, stats for empty container and deleteAll in isolation
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

    const genKeyStrings = (n) => {
      return (new Array(n).fill(0).map((_, idx) => {
        const char = String.fromCharCode(97 + idx % 26)
        // list-[a-z]-[0-(N-1)]
        return `${uniquePrefix}__list_${char}_${idx}`
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

    let it, ret

    // note: when listing all we are not in isolation
    it = state.list()
    ret = await it.next()
    expect(ret.value.keys.length).toBeGreaterThanOrEqual(90)

    it = state.list({ match: `${uniquePrefix}__list_*` })
    ret = await it.next()
    expect(ret.value.keys.sort()).toEqual(keys90)
    expect(await it.next()).toEqual({ done: true, value: undefined })

    it = state.list({ match: `${uniquePrefix}__list_a*` })
    ret = await it.next()
    expect(ret.value.keys.sort()).toEqual([
      `${uniquePrefix}__list_a_0`,
      `${uniquePrefix}__list_a_26`,
      `${uniquePrefix}__list_a_52`,
      `${uniquePrefix}__list_a_78`
    ])
    expect(await it.next()).toEqual({ done: true, value: undefined })

    it = state.list({ match: `${uniquePrefix}__list_*_1` })
    ret = await it.next()
    expect(ret.value.keys.sort()).toEqual([`${uniquePrefix}__list_b_1`])
    expect(await it.next()).toEqual({ done: true, value: undefined })

    // 2. test with many elements and large countHint
    const keys900 = genKeyStrings(900)
    await putKeys(keys900, 60)

    // note: we can't list in isolation without prefix
    it = state.list({ countHint: 1000 })
    ret = await it.next()
    expect(ret.value.keys.length).toBeGreaterThanOrEqual(900)

    it = state.list({ countHint: 1000, match: `${uniquePrefix}__li*t_*` })
    ret = await it.next()
    expect(ret.value.keys.length).toEqual(900)
    expect(await it.next()).toEqual({ done: true, value: undefined })

    it = state.list({ countHint: 1000, match: `${uniquePrefix}__list_z*` })
    ret = await it.next()
    expect(ret.value.keys.length).toEqual(34)
    expect(await it.next()).toEqual({ done: true, value: undefined })

    it = state.list({ match: `${uniquePrefix}__list_*_1` })
    ret = await it.next()
    expect(ret.value.keys.sort()).toEqual([`${uniquePrefix}__list_b_1`])
    expect(await it.next()).toEqual({ done: true, value: undefined })

    // 3. test with many elements while iterating
    let iterations = 0
    let retArray = []
    for await (const { keys } of state.list({ match: `${uniquePrefix}__l*st_*` })) {
      iterations++
      retArray.push(...keys)
    }
    expect(iterations).toBeGreaterThan(5) // should be around 9-10
    expect(retArray.length).toEqual(900)

    iterations = 0
    retArray = []
    for await (const { keys } of state.list({ match: `${uniquePrefix}__list_z*` })) {
      iterations++
      retArray.push(...keys)
    }
    expect(iterations).toEqual(1)
    expect(retArray.length).toEqual(34)

    iterations = 0
    retArray = []
    for await (const { keys } of state.list({ match: `${uniquePrefix}__list_*_1` })) {
      iterations++
      retArray.push(...keys)
    }
    expect(iterations).toEqual(1)
    expect(retArray.length).toEqual(1)

    // 4. make sure expired keys aren't listed
    await putKeys(keys90, 1)
    await waitFor(2000)

    it = state.list({ countHint: 1000, match: `${uniquePrefix}__list_*` })
    ret = await it.next()
    expect(ret.value.keys.length).toEqual(810) // 900 - 90
    expect(await it.next()).toEqual({ done: true, value: undefined })
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
