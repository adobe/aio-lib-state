<!--
Copyright 2024 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
-->

# Adobe I/O Lib State

[![Version](https://img.shields.io/npm/v/@adobe/aio-lib-state.svg)](https://npmjs.org/package/@adobe/aio-lib-state)
[![Downloads/week](https://img.shields.io/npm/dw/@adobe/aio-lib-state.svg)](https://npmjs.org/package/@adobe/aio-lib-state)
![Node.js CI](https://github.com/adobe/aio-lib-state/workflows/Node.js%20CI/badge.svg)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Codecov Coverage](https://img.shields.io/codecov/c/github/adobe/aio-lib-state/main.svg?style=flat-square)](https://codecov.io/gh/adobe/aio-lib-state/) 

A Node JavaScript abstraction on top of distributed/cloud DBs that exposes a simple state persistence API.

You can initialize the lib with your Adobe I/O Runtime (a.k.a OpenWhisk) credentials.

Please note that currently, you must be a customer of [Adobe Developer App Builder](https://www.adobe.io/apis/experienceplatform/project-firefly.html) to use this library. App Builder is a complete framework that enables enterprise developers to build and deploy custom web applications that extend Adobe Experience Cloud solutions and run on Adobe infrastructure.

## Install

```bash
npm install @adobe/aio-lib-state
```

## Use

```js
  const stateLib = require('@adobe/aio-lib-state')

  // init when running in an Adobe I/O Runtime action (OpenWhisk) (uses env vars __OW_API_KEY and __OW_NAMESPACE automatically. default region is 'amer')
  const state = await stateLib.init()
  // set an explicit region
  const state2 = await stateLib.init({ region: 'apac' }) 

  // get
  const res = await state.get('key') // res = { value, expiration }
  const value = res.value

  // put
  await state.put('key', 'value')
  await state.put('another key', 'another value', { ttl: -1 }) // -1 for max expiry (365 days), defaults to 86400 (24 hours)

  // delete
  await state.delete('key')

  // delete all keys and values
  await state.deleteAll()

  // returns true if you have at least one key and value
  await state.any()
```

## Explore

`goto` [API](doc/api.md)

## Debug

set `DEBUG=@adobe/aio-lib-state*` to see debug logs.

## Adobe I/O State Store Limitations (per user)

Apply when init with I/O Runtime credentials:

- Namespace must be in valid AppBuilder format: `amsorg-project(-workspace)?`
- Max state value size: `1MB`.
- Max state key size: `1024 bytes`.
- Supported characters are alphanumeric and `-`,`_`,`.`
- Max-supported TTL is 365 days.
- Default TTL is 1 day.

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
