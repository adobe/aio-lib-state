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

// @ts-nocheck
const { StateStore } = require('../lib/StateStore')

describe('init', () => {
  // eslint-disable-next-line jest/expect-expect
  test('missing implementation', async () => {
    expect.hasAssertions()
    await global.expectToThrowNotImplemented(StateStore.init.bind(StateStore), 'init')
  })
})

describe('constructor', () => {
  // eslint-disable-next-line jest/expect-expect
  test('missing implementation', async () => {
    expect.hasAssertions()
    await global.expectToThrowNotImplemented(() => new StateStore(false), 'StateStore')
  })
})

describe('get', () => {
  // eslint-disable-next-line jest/expect-expect
  test('missing implementation', async () => {
    expect.hasAssertions()
    const state = new StateStore(true)
    await global.expectToThrowNotImplemented(state.get.bind(state, 'key'), '_get')
  })
  // eslint-disable-next-line jest/expect-expect
  test('bad key type', async () => {
    expect.hasAssertions()
    const state = new StateStore(true)
    await global.expectToThrowBadArg(state.get.bind(state, 123), ['string', 'key'], { key: 123 })
  })
  // eslint-disable-next-line jest/expect-expect
  test('bad key characters', async () => {
    expect.hasAssertions()
    const state = new StateStore(true)
    await global.expectToThrowBadArg(state.put.bind(state, '?test', 'value', {}), ['Key', 'cannot', 'contain'], { key: '?test', value: 'value', options: {} })
    await global.expectToThrowBadArg(state.put.bind(state, 't#est', 'value', {}), ['Key', 'cannot', 'contain'], { key: 't#est', value: 'value', options: {} })
    await global.expectToThrowBadArg(state.put.bind(state, 't\\est', 'value', {}), ['Key', 'cannot', 'contain'], { key: 't\\est', value: 'value', options: {} })
    await global.expectToThrowBadArg(state.put.bind(state, 'test/', 'value', {}), ['Key', 'cannot', 'contain'], { key: 'test/', value: 'value', options: {} })
  })
  test('calls _get (part of interface)', async () => {
    expect.hasAssertions()
    const state = new StateStore(true)
    state._get = jest.fn()
    await state.get('key')
    expect(state._get).toHaveBeenCalledTimes(1)
    expect(state._get).toHaveBeenCalledWith('key')
    expect(global.mockLogDebug).toHaveBeenCalledWith('get \'key\'')
  })
})

describe('put', () => {
  // eslint-disable-next-line jest/expect-expect
  test('missing implementation', async () => {
    expect.hasAssertions()
    const state = new StateStore(true)
    await global.expectToThrowNotImplemented(state.put.bind(state, 'key', 'value'), '_put')
  })
  // eslint-disable-next-line jest/expect-expect
  test('bad key type', async () => {
    expect.hasAssertions()
    const state = new StateStore(true)
    await global.expectToThrowBadArg(state.put.bind(state, 123, 'value', {}), ['string', 'key'], { key: 123, value: 'value', options: {} })
  })
  // eslint-disable-next-line jest/expect-expect
  test('bad key characters', async () => {
    expect.hasAssertions()
    const state = new StateStore(true)
    await global.expectToThrowBadArg(state.put.bind(state, '?test', 'value', {}), ['Key', 'cannot', 'contain'], { key: '?test', value: 'value', options: {} })
    await global.expectToThrowBadArg(state.put.bind(state, 't#est', 'value', {}), ['Key', 'cannot', 'contain'], { key: 't#est', value: 'value', options: {} })
    await global.expectToThrowBadArg(state.put.bind(state, 't\\est', 'value', {}), ['Key', 'cannot', 'contain'], { key: 't\\est', value: 'value', options: {} })
    await global.expectToThrowBadArg(state.put.bind(state, 'test/', 'value', {}), ['Key', 'cannot', 'contain'], { key: 'test/', value: 'value', options: {} })
  })
  // eslint-disable-next-line jest/expect-expect
  test('bad options', async () => {
    expect.hasAssertions()
    const state = new StateStore(true)
    const expectedDetails = { key: 'key', value: 'value' }
    await global.expectToThrowBadArg(state.put.bind(state, 'key', 'value', 'options'), ['object', 'options'], { ...expectedDetails, options: 'options' })
    await global.expectToThrowBadArg(state.put.bind(state, 'key', 'value', { nonexiting__option: 'value' }), ['nonexiting__option', 'not allowed'], { ...expectedDetails, options: { nonexiting__option: 'value' } })
    await global.expectToThrowBadArg(state.put.bind(state, 'key', 'value', { ttl: 'value' }), ['ttl', 'number'], { ...expectedDetails, options: { ttl: 'value' } })
    await global.expectToThrowBadArg(state.put.bind(state, 'key', 'value', { ttl: '1' }), ['ttl', 'number'], { ...expectedDetails, options: { ttl: '1' } })
  })
  test('calls _put with default ttl when options is undefined or options.ttl is = 0', async () => {
    expect.hasAssertions()
    const state = new StateStore(true)
    state._put = jest.fn()
    await state.put('key', 'value')
    expect(state._put).toHaveBeenCalledTimes(1)
    expect(state._put).toHaveBeenCalledWith('key', 'value', { ttl: StateStore.DefaultTTL })

    state._put.mockReset()
    await state.put('key', 'value', { ttl: 0 })
    expect(state._put).toHaveBeenCalledTimes(1)
    expect(state._put).toHaveBeenCalledWith('key', 'value', { ttl: StateStore.DefaultTTL })
    expect(global.mockLogDebug).toHaveBeenCalledWith(`put 'key' with ttl ${StateStore.DefaultTTL}`)
  })
  test('calls _put with custom ttl when options.ttl is set', async () => {
    expect.hasAssertions()
    const state = new StateStore(true)
    state._put = jest.fn()
    await state.put('key', 'value', { ttl: 99 })
    expect(state._put).toHaveBeenCalledTimes(1)
    expect(state._put).toHaveBeenCalledWith('key', 'value', { ttl: 99 })
    expect(global.mockLogDebug).toHaveBeenCalledWith('put \'key\' with ttl 99')
  })
})

describe('delete', () => {
  // eslint-disable-next-line jest/expect-expect
  test('missing implementation', async () => {
    expect.hasAssertions()
    const state = new StateStore(true)
    await global.expectToThrowNotImplemented(state.delete.bind(state, 'key'), '_delete')
  })
  // eslint-disable-next-line jest/expect-expect
  test('bad key type', async () => {
    expect.hasAssertions()
    const state = new StateStore(true)
    await global.expectToThrowBadArg(state.delete.bind(state, 123), ['string', 'key'], { key: 123 })
  })
  // eslint-disable-next-line jest/expect-expect
  test('bad key characters', async () => {
    expect.hasAssertions()
    const state = new StateStore(true)
    await global.expectToThrowBadArg(state.put.bind(state, '?test', 'value', {}), ['Key', 'cannot', 'contain'], { key: '?test', value: 'value', options: {} })
    await global.expectToThrowBadArg(state.put.bind(state, 't#est', 'value', {}), ['Key', 'cannot', 'contain'], { key: 't#est', value: 'value', options: {} })
    await global.expectToThrowBadArg(state.put.bind(state, 't\\est', 'value', {}), ['Key', 'cannot', 'contain'], { key: 't\\est', value: 'value', options: {} })
    await global.expectToThrowBadArg(state.put.bind(state, 'test/', 'value', {}), ['Key', 'cannot', 'contain'], { key: 'test/', value: 'value', options: {} })
  })
  test('calls _delete (part of interface)', async () => {
    expect.hasAssertions()
    const state = new StateStore(true)
    state._delete = jest.fn()
    await state.delete('key', 'value')
    expect(state._delete).toHaveBeenCalledTimes(1)
    expect(state._delete).toHaveBeenCalledWith('key')
    expect(global.mockLogDebug).toHaveBeenCalledWith('delete \'key\'')
  })
})
