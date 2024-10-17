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

/* ************* NOTE 1: these tests must be able to run concurrently across multiple instances ************* */
/* ************* NOTE 2: requires env vars TEST_AUTH_1, TEST_NS_1 and TEST_AUTH_2, TEST_NS_2 for 2 different namespaces. ************* */

const path = require('node:path')

// load .env values in the e2e folder, if any
require('dotenv').config({ path: path.join(__dirname, '.env') })

const { MAX_TTL_SECONDS } = require('../lib/constants')
const stateLib = require('../index')
const { randomInt } = require('node:crypto')

const uniquePrefix = `${Date.now()}.${randomInt(100)}`
const testKey = `${uniquePrefix}__e2e_test_state_key`
const testKey2 = `${uniquePrefix}__e2e_test_state_key2`

jest.setTimeout(60000) // 1 minute per test

const initStateEnv = async (n = 1) => {
  delete process.env.__OW_API_KEY
  delete process.env.__OW_NAMESPACE
  process.env.__OW_API_KEY = process.env[`TEST_AUTH_${n}`]
  process.env.__OW_NAMESPACE = process.env[`TEST_NAMESPACE_${n}`]
  const state = await stateLib.init()
  // make sure we cleanup the namespace, note that delete might fail as it is an op under test
  await state.deleteAll({ match: `${uniquePrefix}*` })
  return state
}

// helpers
const genKeyStrings = (n, identifier) => {
  return (new Array(n).fill(0).map((_, idx) => {
    const char = String.fromCharCode(97 + idx % 26)
    // list-[a-z]-[0-(N-1)]
    return `${identifier}_${char}_${idx}`
  }))
}
const putKeys = async (state, keys, { ttl, batchSize = 50 }) => {
  const _putKeys = async (keys, ttl) => {
    await Promise.all(keys.map(async (k, idx) => await state.put(k, `value-${idx}`, { ttl })))
  }

  let i = 0
  while (i < keys.length - batchSize) {
    await _putKeys(keys.slice(i, i + batchSize), ttl)
    i += batchSize
  }
  // final call
  await _putKeys(keys.slice(i), ttl)
}
const waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const listAll = async (state, options = {}) => {
  const acc = []
  for await (const { keys } of state.list(options)) {
    acc.push(...keys)
  }
  return acc
}

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
    expect(await state.put(testKey, testValue, { ttl: MAX_TTL_SECONDS })).toEqual(testKey)
    res = await state.get(testKey)
    resTime = new Date(res.expiration).getTime()
    expect(resTime).toBeGreaterThanOrEqual(nowPlus365Days - 10000)

    // 4. test that after ttl object is deleted
    expect(await state.put(testKey, testValue, { ttl: 2 })).toEqual(testKey)
    res = await state.get(testKey)
    expect(new Date(res.expiration).getTime()).toBeLessThanOrEqual(new Date(Date.now() + 2000).getTime())
    await waitFor(3000) // give it one more sec - ttl is not so precise
    expect(await state.get(testKey)).toEqual(undefined)

    // 5. infinite ttl not supported
    await expect(state.put(testKey, testValue, { ttl: -1 })).rejects.toThrow()
  })

  test('list: countHint & match', async () => {
    const state = await initStateEnv()

    const prefix = `${uniquePrefix}__list`
    const keys900 = genKeyStrings(900, prefix).sort()
    await putKeys(state, keys900, { ttl: 60 })

    // listAll without match, note that other keys may be stored in namespace.
    const retAll = await listAll(state)
    expect(retAll.length).toBeGreaterThanOrEqual(900)

    // default countHint = 100
    const retHint100 = await listAll(state, { match: `${uniquePrefix}__list*` })
    expect(retHint100.length).toEqual(900)
    expect(retHint100.sort()).toEqual(keys900)

    // set countHint = 1000
    //   in most cases, list should return in 1 iteration,
    //   but we can't guarantee this as the server may return with less keys and
    //   require additional iterations, especially if there are many keys in the namespace.
    //   This is why we call listAll with countHint 1000 too.
    const retHint1000 = await listAll(state, { match: `${uniquePrefix}__list*`, countHint: 1000 })
    expect(retHint1000.length).toEqual(900)
    expect(retHint1000.sort()).toEqual(keys900)

    // sub patterns
    const retA = await listAll(state, { match: `${uniquePrefix}__list_a*` })
    expect(retA.length).toEqual(35)
    expect(retA).toContain(
      `${uniquePrefix}__list_a_26`
    )

    const ret1 = await listAll(state, { match: `${uniquePrefix}__list_*_1` })
    expect(ret1.length).toEqual(1)

    const retstar = await listAll(state, { match: `${uniquePrefix}__l*st_*` })
    expect(retstar.length).toEqual(900)
  })

  test('list expired keys', async () => {
    const state = await initStateEnv()

    // make sure expired keys aren't listed
    const keysExpired = genKeyStrings(90, `${uniquePrefix}__exp_yes`)
    const keysNotExpired = genKeyStrings(90, `${uniquePrefix}__exp_no`).sort()
    await putKeys(state, keysExpired, { ttl: 1 })
    await putKeys(state, keysNotExpired, { ttl: 120 })
    await waitFor(2000)

    // Note, we don't guarantee not returning expired keys, and in some rare cases it may happen.
    // if the test fails we should disable it.
    const ret = await listAll(state, { match: `${uniquePrefix}__exp*` })
    expect(ret.sort()).toEqual(keysNotExpired)
  })

  test('deleteAll test', async () => {
    const state = await initStateEnv()

    // < 100 keys
    const keys90 = genKeyStrings(90, `${uniquePrefix}__deleteAll`).sort()
    await putKeys(state, keys90, 60)
    expect(await state.deleteAll({ match: `${uniquePrefix}__deleteAll_a*` })).toEqual({ keys: 4 })
    expect(await state.deleteAll({ match: `${uniquePrefix}__deleteAll_*` })).toEqual({ keys: 86 })

    // > 1000 keys
    const keys1100 = genKeyStrings(1100, `${uniquePrefix}__deleteAll`).sort()
    await putKeys(state, keys1100, 60)
    expect(await state.deleteAll({ match: `${uniquePrefix}__deleteAll_*_1` })).toEqual({ keys: 1 })
    expect(await state.deleteAll({ match: `${uniquePrefix}__deleteAll_*_1*0` })).toEqual({ keys: 21 }) // 10, 100 - 190, 1000-1090
    expect(await state.deleteAll({ match: `${uniquePrefix}__deleteAll_*` })).toEqual({ keys: 1078 })
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

  // this test is slow to execute uncomment if needed
  // eslint-disable-next-line jest/no-commented-out-tests
  // test('list while having a large dataset stored', async () => {
  //   // reason: https://github.com/adobe/aio-lib-state/issues/194
  //   const state = await initStateEnv()

  //   const keysBig = genKeyStrings(15000, `${uniquePrefix}__big_list`).sort()
  //   await putKeys(state, keysBig, { ttl: 300 })

  //   const keysSmall = genKeyStrings(82, `${uniquePrefix}__small_list`).sort()
  //   await putKeys(state, keysSmall, { ttl: 300 }) // ttl=300s

  //   // ensure we can list adhoc data
  //   const retArray = []
  //   for await (const { keys } of state.list({ match: `${uniquePrefix}__small_list*`, countHint: 100 })) {
  //     retArray.push(...keys)
  //   }
  //   // in this test we want to make sure that list works even when many keys are included
  //   expect(retArray.length).toEqual(82)
  // }, 300 * 1000)
})
