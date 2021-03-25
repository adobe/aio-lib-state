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

const { CosmosStateStore } = require('../../lib/impl/CosmosStateStore')
const { StateStore } = require('../../lib/StateStore')
const cloneDeep = require('lodash.clonedeep')

const cosmos = require('@azure/cosmos')
jest.mock('@azure/cosmos')

const fakeCosmosResourceCredentials = {
  endpoint: 'https://fake.com',
  resourceToken: 'fakeToken',
  databaseId: 'fakedb',
  containerId: 'fakeContainer',
  partitionKey: 'fakePK'
}

const fakeCosmosMasterCredentials = {
  endpoint: 'https://fake.com',
  masterKey: 'fakeKey',
  databaseId: 'fakedb',
  containerId: 'fakeContainer',
  partitionKey: 'fakePK'
}

const fakeCosmosTVMResponse = {
  expiration: new Date(8640000000000000).toISOString(),
  ...fakeCosmosResourceCredentials
}

const cosmosDatabaseMock = jest.fn()
const cosmosContainerMock = jest.fn()
beforeEach(async () => {
  cosmos.CosmosClient.mockReset()
  cosmosContainerMock.mockReset()
  cosmosDatabaseMock.mockReset()

  cosmos.CosmosClient.mockImplementation(() => {
    return {
      database: cosmosDatabaseMock.mockReturnValue({
        container: cosmosContainerMock
      })
    }
  })
})

// eslint-disable-next-line jsdoc/require-jsdoc
async function testProviderErrorHandling (func, mock, fparams) {
  // eslint-disable-next-line jsdoc/require-jsdoc
  async function testOne (status, errorMessage, expectCheck, isInternal, ...addArgs) {
    const providerError = new Error(errorMessage)
    if (status) {
      providerError.code = status
    }

    const expectedErrorDetails = { ...fparams }
    if (isInternal) { expectedErrorDetails._internal = providerError }
    mock.mockReset()
    mock.mockRejectedValue(providerError)
    await global[expectCheck](func, ...addArgs, expectedErrorDetails)
  }

  await testOne(403, 'This is blocked by your Cosmos DB account firewall settings.', 'expectToThrowFirewall')
  await testOne(403, 'fakeError', 'expectToThrowForbidden')
  await testOne(413, 'fakeError', 'expectToThrowTooLarge')
  await testOne(500, 'fakeError', 'expectToThrowInternalWithStatus', true, 500)
  await testOne(undefined, 'fakeError', 'expectToThrowInternal', true)
  // when provider resolves with bad status which is not 404
  const providerResponse = {
    statusCode: 400
  }
  mock.mockReset()
  mock.mockResolvedValue(providerResponse)
  await global.expectToThrowInternalWithStatus(func, 400, { ...fparams, _internal: providerResponse })
}

describe('init', () => {
  // eslint-disable-next-line jsdoc/require-jsdoc
  async function testInitBadArg (object, missing, expectedWords) {
    if (typeof missing === 'string') missing = [missing]
    if (typeof expectedWords === 'string') expectedWords = [expectedWords]

    if (!expectedWords) expectedWords = missing

    const args = cloneDeep(object)

    let expectedErrorDetails = {}
    if (args) {
      missing.forEach(m => delete args[m])
      expectedErrorDetails = cloneDeep(args)
      if (expectedErrorDetails.masterKey) expectedErrorDetails.masterKey = '<hidden>'
      if (expectedErrorDetails.resourceToken) expectedErrorDetails.resourceToken = '<hidden>'
    }

    await global.expectToThrowBadArg(CosmosStateStore.init.bind(CosmosStateStore, args), expectedWords, expectedErrorDetails)
  }
  const checkInitDebugLogNoSecrets = (str) => expect(global.mockLogDebug).not.toHaveBeenCalledWith(expect.stringContaining(str))

  describe('with bad args', () => {
    // eslint-disable-next-line jest/expect-expect
    test('with undefined credentials', async () => {
      await testInitBadArg(undefined, [], ['cosmos'])
    })
    // eslint-disable-next-line jest/expect-expect
    test('with resourceToken and missing endpoint, databaseId, containerId, partitionKey', async () => {
      const array = ['endpoint', 'databaseId', 'containerId', 'partitionKey']
      for (let i = 0; i < array.length; i++) {
        await testInitBadArg(fakeCosmosResourceCredentials, array[i], 'required')
      }
    })
    // eslint-disable-next-line jest/expect-expect
    test('with masterKey and missing endpoint, databaseId, containerId, partitionKey', async () => {
      const array = ['endpoint', 'databaseId', 'containerId', 'partitionKey']
      for (let i = 0; i < array.length; i++) {
        await testInitBadArg(fakeCosmosMasterCredentials, array[i], 'required')
      }
    })
    // eslint-disable-next-line jest/expect-expect
    test('with missing masterKey and resourceToken', async () => {
      await testInitBadArg(fakeCosmosMasterCredentials, ['resourceToken', 'masterKey'])
    })
    // eslint-disable-next-line jest/expect-expect
    test('with both masterKey and resourceToken', async () => {
      const args = { ...fakeCosmosResourceCredentials, masterKey: 'fakeKey' }
      await testInitBadArg(args, [], ['resourceToken', 'masterKey'])
    })
    // eslint-disable-next-line jest/expect-expect
    test('with unknown option', async () => {
      const args = { ...fakeCosmosMasterCredentials, someFake__unknown: 'hello' }
      await testInitBadArg(args, [], ['someFake__unknown', 'not', 'allowed'])
    })
    describe('with correct args', () => {
      const testInitOK = async (credentials) => {
        const state = await CosmosStateStore.init(credentials)
        expect(state).toBeInstanceOf(CosmosStateStore)
        expect(state).toBeInstanceOf(StateStore)
        expect(cosmos.CosmosClient).toHaveBeenCalledTimes(1)
        expect(cosmos.CosmosClient).toHaveBeenCalledWith(expect.objectContaining({ endpoint: credentials.endpoint }))
        expect(cosmosDatabaseMock).toHaveBeenCalledTimes(1)
        expect(cosmosDatabaseMock).toHaveBeenCalledWith(credentials.databaseId)
        expect(cosmosContainerMock).toHaveBeenCalledTimes(1)
        expect(cosmosContainerMock).toHaveBeenCalledWith(credentials.containerId)
      }

      // eslint-disable-next-line jest/expect-expect
      test('with resourceToken', async () => {
        await testInitOK(fakeCosmosResourceCredentials)
        checkInitDebugLogNoSecrets(fakeCosmosResourceCredentials.resourceToken)
      })
      // eslint-disable-next-line jest/expect-expect
      test('with resourceToken and expiration (tvm response format)', async () => {
        await testInitOK(fakeCosmosTVMResponse)
        checkInitDebugLogNoSecrets(fakeCosmosTVMResponse.resourceToken)
      })
      // eslint-disable-next-line jest/expect-expect
      test('with masterKey', async () => {
        await testInitOK(fakeCosmosMasterCredentials)
        checkInitDebugLogNoSecrets(fakeCosmosMasterCredentials.masterKey)
      })
    })
  })
})

describe('_get', () => {
  const cosmosItemMock = jest.fn()
  const cosmosItemReadMock = jest.fn()
  beforeEach(async () => {
    cosmosItemMock.mockReset()
    cosmosItemReadMock.mockReset()
    cosmosContainerMock.mockReturnValue({
      item: cosmosItemMock.mockReturnValue({
        read: cosmosItemReadMock
      })
    })
  })

  test('with existing key value and no ttl', async () => {
    cosmosItemReadMock.mockResolvedValue({
      resource: {
        value: 'fakeValue',
        _ts: 123456789,
        ttl: -1
      }
    })
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    const res = await state._get('fakeKey')
    expect(res.value).toEqual('fakeValue')
    expect(res.expiration).toEqual(null)
    expect(cosmosItemReadMock).toHaveBeenCalledTimes(1)
    expect(cosmosItemMock).toHaveBeenCalledWith('fakeKey', state._cosmos.partitionKey)
  })
  test('with existing key and value=undefined', async () => {
    cosmosItemReadMock.mockResolvedValue({
      resource: {
        value: undefined,
        _ts: 123456789,
        ttl: -1
      }
    })
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    const res = await state._get('fakeKey')
    expect(res.value).toEqual(undefined)
    expect(res.expiration).toEqual(null)
  })
  test('with non existing key value', async () => {
    cosmosItemReadMock.mockResolvedValue({
      resource: undefined,
      statusCode: 404
    })
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    const res = await state._get('fakeKey')
    expect(res).toEqual(undefined)
  })
  test('with key value that has a non negative ttl', async () => {
    cosmosItemReadMock.mockResolvedValue({
      resource: {
        value: { a: { fake: 'value' } },
        _ts: 123456789,
        ttl: 10
      }
    })
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    const res = await state._get('fakeKey')
    expect(res.value).toEqual({ a: { fake: 'value' } })
    expect(res.expiration).toEqual(new Date(123456789 * 1000 + 10 * 1000).toISOString())
  })
  // eslint-disable-next-line jest/expect-expect
  test('with error response from provider', async () => {
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    await testProviderErrorHandling(state._get.bind(state, 'key'), cosmosItemReadMock, { key: 'key' })
  })
})

describe('_delete', () => {
  const cosmosItemMock = jest.fn()
  const cosmosItemDeleteMock = jest.fn()
  beforeEach(async () => {
    cosmosItemMock.mockReset()
    cosmosItemDeleteMock.mockReset()
    cosmosContainerMock.mockReturnValue({
      item: cosmosItemMock.mockReturnValue({
        delete: cosmosItemDeleteMock.mockResolvedValue({})
      })
    })
  })

  test('with no errors', async () => {
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    const ret = await state._delete('fakeKey')
    expect(ret).toEqual('fakeKey')
    expect(cosmosItemDeleteMock).toHaveBeenCalledTimes(1)
    expect(cosmosItemMock).toHaveBeenCalledWith('fakeKey', state._cosmos.partitionKey)
  })
  test('when cosmos return with a 404 (should return null)', async () => {
    cosmosItemDeleteMock.mockRejectedValue({ code: 404 })
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    const ret = await state._delete('fakeKey')
    expect(ret).toEqual(null)
    expect(cosmosItemDeleteMock).toHaveBeenCalledTimes(1)
    expect(cosmosItemMock).toHaveBeenCalledWith('fakeKey', state._cosmos.partitionKey)
  })
  // eslint-disable-next-line jest/expect-expect
  test('with error response from provider', async () => {
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    await testProviderErrorHandling(state._delete.bind(state, 'key'), cosmosItemDeleteMock, { key: 'key' })
  })
})

describe('_put', () => {
  const cosmosUpsertMock = jest.fn()
  beforeEach(async () => {
    cosmosUpsertMock.mockReset()
    cosmosContainerMock.mockReturnValue({
      items: {
        upsert: cosmosUpsertMock.mockResolvedValue({})
      }
    })
  })

  test('with default ttl (ttl is always set)', async () => {
    const key = 'fakeKey'
    const value = 'fakeValue'
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    const ret = await state._put(key, 'fakeValue', { ttl: StateStore.DefaultTTL })
    expect(ret).toEqual(key)
    expect(cosmosUpsertMock).toHaveBeenCalledTimes(1)
    expect(cosmosUpsertMock).toHaveBeenCalledWith({ id: key, partitionKey: state._cosmos.partitionKey, ttl: StateStore.DefaultTTL, value })
  })
  test('with positive ttl', async () => {
    const key = 'fakeKey'
    const value = 'fakeValue'
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    const ret = await state._put(key, 'fakeValue', { ttl: 99 })
    expect(ret).toEqual(key)
    expect(cosmosUpsertMock).toHaveBeenCalledTimes(1)
    expect(cosmosUpsertMock).toHaveBeenCalledWith({ id: key, partitionKey: state._cosmos.partitionKey, ttl: 99, value })
  })
  test('with negative ttl (converts to -1 always)', async () => {
    const key = 'fakeKey'
    const value = 'fakeValue'
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    const ret = await state._put(key, 'fakeValue', { ttl: -99 })
    expect(ret).toEqual(key)
    expect(cosmosUpsertMock).toHaveBeenCalledTimes(1)
    expect(cosmosUpsertMock).toHaveBeenCalledWith({ id: key, partitionKey: state._cosmos.partitionKey, ttl: -1, value })
  })
  // eslint-disable-next-line jest/expect-expect
  test('with error response from provider', async () => {
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    await testProviderErrorHandling(state._put.bind(state, 'key', 'value', {}), cosmosUpsertMock, { key: 'key', value: 'value', options: {} })
  })
})

describe('_list', () => {
  const cosmosItemsMock = jest.fn()
  const cosmosQueryMock = jest.fn()
  const cosmosFetchNextMock = jest.fn()
  beforeEach(async () => {
    cosmosItemsMock.mockReset()
    cosmosQueryMock.mockReset()
    cosmosFetchNextMock.mockReset()

    cosmosQueryMock.mockReturnValue({
      fetchNext: cosmosFetchNextMock
    })
    cosmosItemsMock.mockReturnValue({
      query: cosmosQueryMock
    })
    cosmosContainerMock.mockReturnValue({
      items: {
        query: cosmosQueryMock
      }
    })
  })

  test('with valid keys hasMoreResults false', async () => {
    const queryStr = 'SELECT c.id,c.ttl,c._ts from c where c.partitionKey=\'fakePK\''
    const queryCondition = { continuationToken: undefined, initialHeaders: { 'x-ms-documentdb-partitionkey': '["fakePK"]' } }
    const keys = [
      { id: 'test', ttl: -1, _ts: 123456 }
    ]
    const expectedKeys = [
      { key: 'test', ttl: -1, timestamp: 123456 }
    ]
    cosmosFetchNextMock.mockResolvedValue({
      resources: keys,
      hasMoreResults: false
    })
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    const res = await state._list()
    expect(cosmosQueryMock).toHaveBeenCalledWith(queryStr, queryCondition)
    expect(res.keys).toEqual(expectedKeys)
    expect(res.hasMoreResults).toEqual(false)
    expect(res.continuationToken).toEqual(undefined)
  })

  test('with valid keys hasMoreResults true and continuationToken', async () => {
    const queryStr = 'SELECT c.id,c.ttl,c._ts from c where c.partitionKey=\'fakePK\''
    const queryCondition = { continuationToken: undefined, initialHeaders: { 'x-ms-documentdb-partitionkey': '["fakePK"]' } }
    const keys = [
      { id: 'test1', ttl: -1, _ts: 123456 },
      { id: 'test2', ttl: -1, _ts: 123456 },
      { id: 'test3', ttl: -1, _ts: 123456 },
      { id: 'test4', ttl: -1, _ts: 123456 }
    ]
    const expectedKeys = [
      { key: 'test1', ttl: -1, timestamp: 123456 },
      { key: 'test2', ttl: -1, timestamp: 123456 },
      { key: 'test3', ttl: -1, timestamp: 123456 },
      { key: 'test4', ttl: -1, timestamp: 123456 }
    ]
    cosmosFetchNextMock.mockResolvedValue({
      resources: keys,
      hasMoreResults: true,
      continuationToken: 'testtoken'
    })
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    const res = await state._list()
    expect(cosmosQueryMock).toHaveBeenCalledWith(queryStr, queryCondition)
    expect(res.keys).toEqual(expectedKeys)
    expect(res.hasMoreResults).toEqual(true)
    expect(res.continuationToken).toEqual('testtoken')
  })

  test('with continuationToken passed to list function', async () => {
    const queryStr = 'SELECT c.id,c.ttl,c._ts from c where c.partitionKey=\'fakePK\''
    const queryCondition = { continuationToken: 'testtoken', initialHeaders: { 'x-ms-documentdb-partitionkey': '["fakePK"]' } }
    const keys = [
      { id: 'test', ttl: -1, _ts: 123456 }
    ]
    const expectedKeys = [
      { key: 'test', ttl: -1, timestamp: 123456 }
    ]
    cosmosFetchNextMock.mockResolvedValue({
      resources: keys,
      hasMoreResults: false
    })
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    const res = await state._list('testtoken')
    expect(cosmosQueryMock).toHaveBeenCalledWith(queryStr, queryCondition)
    expect(res.keys).toEqual(expectedKeys)
    expect(res.hasMoreResults).toEqual(false)
    expect(res.continuationToken).toEqual(undefined)
  })
})
