<!--
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
-->

[![Version](https://img.shields.io/npm/v/@adobe/aio-lib-state.svg)](https://npmjs.org/package/@adobe/aio-lib-state)
[![Downloads/week](https://img.shields.io/npm/dw/@adobe/aio-lib-state.svg)](https://npmjs.org/package/@adobe/aio-lib-state)
[![Build Status](https://travis-ci.com/adobe/aio-lib-state.svg?branch=master)](https://travis-ci.com/adobe/aio-lib-state)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Codecov Coverage](https://img.shields.io/codecov/c/github/adobe/aio-lib-state/master.svg?style=flat-square)](https://codecov.io/gh/adobe/aio-lib-state/) 

# Adobe I/O Lib State

A JavaScript abstraction on top of distributed/cloud DBs that exposes a simple state persistence API.

You can initialize the lib with your Adobe I/O Runtime (a.k.a OpenWhisk) credentials.

Alternatively, you can bring your own cloud db keys. As of now we only support Azure Cosmos.

## Install

```bash
npm install @adobe/aio-lib-state
```

## Use

```js
  const stateLib = require('@adobe/aio-lib-state')

  // init
  // init sdk using OpenWhisk credentials
  const state = await stateLib.init({ ow: { namespace, auth } })
  // init when env vars __OW_API_KEY and __OW_NAMESPACE are set (e.g. when running in an OpenWhisk action)
  const state = await stateLib.init()
  // or if you want to use your own cloud DB account (make sure your partition key path is /partitionKey)
  const state = await stateLib.init({ cosmos: { endpoint, masterKey, databaseId, containerId, partitionKey } })

  // get
  const res = await state.get('key') // res = { value, expiration }
  const value = res.value

  // put
  await state.put('key', 'value')
  await state.put('key', { anObject: 'value' }, { ttl: -1 }) // -1 for no expiry, defaults to 86400 (24 hours)

  // delete
  await state.delete('key')
```

## Explore

`goto` [API](doc/api.md)

## Debug

set `DEBUG=@adobe/aio-lib-state*` to see debug logs.

## Adobe I/O State Store Limitations (per user)

Apply when init with OW credentials (and not own cloud DB credentials):

- Max state value size: `2MB`
- Max state key size: `1024 bytes`
- Max total state size: `10 GB`
- Token expiry (need to re-init after expiry): `1 hour`

## Adobe I/O State Store Consistency Guarantees

### Consistency across State Instances

Operations across multiple State instances (returned by `stateLib.init()`) are **eventually consistent**. For example, let's consider two state instances `a` and `b` initialized with the same credentials, then

```javascript
const a = await state.init()
const b = await state.init()
await a.put('food', 'beans')
await b.put('food', 'carrots')
console.log(await a.get('key'))
```

might log either `beans` or `carrots` but eventually `a.get('food')` will always return `carrots`.

Operations within a single instance however are guaranteed to be **strongly consistent**.

Note that atomicity is ensured, i.e.  `a.get('food')` will never return something like `beacarronsts`.

### Adobe I/O Runtime considerations

State lib is expected to be used in Adobe I/O Runtime serverless actions. A new instance cans be created on every new invocation inside the main function of the serverless action as follows:

```javascript
const State = require('@adobe/aio-sdk').State

function main (params) {
  const state = await State.init()
  // do operations on state
```

It's important to understand that in this cas, on every invocation a new State instance is created, meaning that operations will be only **eventually consistent** across invocations but **strongly consistent** within an invocation.

Also note that reusing the State instance by storing it in a global variable outside of the main function would not ensure **strong consistency** across all invocations as the action could be executed in a separate Docker container.

Here is an example showcasing two invocations of the same action with an initial state `{ key: 'hello'}`:

Invocation A                          |     Invocation B                      |
| :---------------------------------- | ----------------------------------:   |
`state = State.init()`                |                                       |
`state.get(key)` => returns hello     |                                       |
`state.put(key, 'bonjour')`           |                                       |
`state.get(key)` => returns bonjour   |                                       |
|                                     | `state = State.init()`                |
|                                     | `state.get(key)` => hello OR bonjour  |

## Troubleshooting

### `"[StateLib:ERROR_INTERNAL] unknown error response from provider with status: unknown"`

- when using `@adobe/aio-lib-state` in an action bundled with **webpack** please make sure to turn off minification and enable resolving of es6 modules. Add the following lines to your webpack config:

```javascript
  optimization: {
    minimize: false
  },
  resolve: {
    extensions: ['.js'],
    mainFields: ['main']
  }
```

## Contributing

Contributions are welcomed! Read the [Contributing Guide](./.github/CONTRIBUTING.md) for more information.

## Licensing

This project is licensed under the Apache V2 License. See [LICENSE](LICENSE) for more information.
