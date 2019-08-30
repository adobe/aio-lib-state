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

Alternatively, you can bring your own cloud db keys. As of now we only support Azure Cosmos but AWS Dynamo is the next
on the todo list and will soon be available.

## Install

```bash
npm install @adobe/aio-lib-state
```

## Use

```js
  const stateLib = require('@adobe/aio-lib-state')

  // init
  // init sdk using OpenWhisk credentials
  // [TEMPORARY tvmApiUrl, not yet deployed to adobeio]
  const state = await stateLib.init({ ow: { namespace, auth } }, { tvmApiUrl: 'https://mraho.adobeioruntime.net/apis/tvm' })
  // init when env vars __OW_AUTH and __OW_NAMESPACE are set (e.g. when running in an OpenWhisk action)
  const state = await stateLib.init()
  // or if you want to use your own cloud DB account
  const state = await stateLib.init({ cosmos: { endpoint, masterKey, databaseId, containerId, partitionKey } })

  // get
  const value = await state.get('key')

  // put
  await state.put('key', 'value')
  await state.put('key', { anObject: 'value' })

  // delete
  await state.delete('key')

  // list all keys, use wisely => slow O(#keys)
  const keys = await state.listKeys()
```

## Explore

`goto` [API](doc/api.md)

## Contributing

Contributions are welcomed! Read the [Contributing Guide](./.github/CONTRIBUTING.md) for more information.

## Licensing

This project is licensed under the Apache V2 License. See [LICENSE](LICENSE) for more information.
