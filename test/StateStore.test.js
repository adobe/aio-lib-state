// @ts-nocheck
const { StateStore } = require('../lib/StateStore')

beforeEach(() => {
  expect.hasAssertions()
  jest.restoreAllMocks()
})

describe('init', () => {
  test('missing implementation', async () => {
    await expect(StateStore.init.bind(StateStore)).toThrowNotImplemented('init')
  })
})

describe('constructor', () => {
  test('missing implementation', async () => {
    await expect(() => new StateStore(false)).toThrowNotImplemented('StateStore')
  })
})

describe('get', () => {
  test('missing implementation', async () => {
    const state = new StateStore(true)
    await expect(state.get.bind(state, 'key')).toThrowNotImplemented('_get')
  })
  test('bad key type', async () => {
    const state = new StateStore(true)
    await expect(state.get.bind(state, 123)).toThrowBadArgWithMessageContaining(['string', 'key'])
  })
  test('calls _get (part of interface)', async () => {
    const state = new StateStore(true)
    state._get = jest.fn()
    await state.get('key')
    expect(state._get).toHaveBeenCalledTimes(1)
    expect(state._get).toHaveBeenCalledWith('key')
  })
})

describe('put', () => {
  test('missing implementation', async () => {
    const state = new StateStore(true)
    await expect(state.put.bind(state, 'key', 'value')).toThrowNotImplemented('_put')
  })
  test('bad key type', async () => {
    const state = new StateStore(true)
    await expect(state.put.bind(state, 123)).toThrowBadArgWithMessageContaining(['string', 'key'])
  })
  test('bad options', async () => {
    const state = new StateStore(true)
    await expect(state.put.bind(state, 'key', 'value', 'options')).toThrowBadArgWithMessageContaining(['options', 'object'])
    await expect(state.put.bind(state, 'key', 'value', { nonexiting__option: 'value' })).toThrowBadArgWithMessageContaining(['nonexiting__option', 'not allowed'])
    await expect(state.put.bind(state, 'key', 'value', { ttl: 'value' })).toThrowBadArgWithMessageContaining(['ttl', 'number'])
  })
  test('calls _put with default ttl when options is undefined or options.ttl is = 0', async () => {
    const state = new StateStore(true)
    state._put = jest.fn()
    await state.put('key', 'value')
    expect(state._put).toHaveBeenCalledTimes(1)
    expect(state._put).toHaveBeenCalledWith('key', 'value', { ttl: StateStore.DefaultTTL })

    state._put.mockReset()
    await state.put('key', 'value', { ttl: 0 })
    expect(state._put).toHaveBeenCalledTimes(1)
    expect(state._put).toHaveBeenCalledWith('key', 'value', { ttl: StateStore.DefaultTTL })
  })
  test('calls _put with custom ttl when options.ttl is set', async () => {
    const state = new StateStore(true)
    state._put = jest.fn()
    await state.put('key', 'value', { ttl: 99 })
    expect(state._put).toHaveBeenCalledTimes(1)
    expect(state._put).toHaveBeenCalledWith('key', 'value', { ttl: 99 })
  })
})

describe('delete', () => {
  test('missing implementation', async () => {
    const state = new StateStore(true)
    await expect(state.delete.bind(state, 'key')).toThrowNotImplemented('_delete')
  })
  test('bad key type', async () => {
    const state = new StateStore(true)
    await expect(state.delete.bind(state, 123)).toThrowBadArgWithMessageContaining(['string', 'key'])
  })
  test('calls _delete (part of interface)', async () => {
    const state = new StateStore(true)
    state._delete = jest.fn()
    await state.delete('key', 'value')
    expect(state._delete).toHaveBeenCalledTimes(1)
    expect(state._delete).toHaveBeenCalledWith('key')
  })
})
