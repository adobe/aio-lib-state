## Modules

<dl>
<dt><a href="#module_types">types</a></dt>
<dd></dd>
</dl>

## Classes

<dl>
<dt><a href="#StateStore">StateStore</a></dt>
<dd><p>Cloud State Management</p>
</dd>
<dt><a href="#StateStoreError">StateStoreError</a> ⇐ <code>Error</code></dt>
<dd><p>Errors raised by state store lib</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#init">init([config])</a> ⇒ <code><a href="#StateStore">Promise.&lt;StateStore&gt;</a></code></dt>
<dd><p>Initializes and returns the key-value-store SDK.</p>
<p>To use the SDK you must either provide your
<a href="#module_types..OpenWhiskCredentials">OpenWhisk credentials</a> in
<code>config.ow</code> or your own
<a href="#module_types..AzureCosmosMasterCredentials">Azure Cosmos credentials</a> in <code>config.cosmos</code>.</p>
<p>OpenWhisk credentials can also be read from environment variables (<code>OW_NAMESPACE</code> or <code>__OW_NAMESPACE</code> and <code>OW_AUTH</code> or <code>__OW_AUTH</code>).</p>
</dd>
</dl>

<a name="module_types"></a>

## types

* [types](#module_types)
    * [~OpenWhiskCredentials](#module_types..OpenWhiskCredentials) : <code>object</code>
    * [~AzureCosmosPartitionResourceCredentials](#module_types..AzureCosmosPartitionResourceCredentials) : <code>object</code>
    * [~AzureCosmosMasterCredentials](#module_types..AzureCosmosMasterCredentials) : <code>object</code>
    * [~StateStorePutOptions](#module_types..StateStorePutOptions) : <code>object</code>

<a name="module_types..OpenWhiskCredentials"></a>

### types~OpenWhiskCredentials : <code>object</code>
An object holding the OpenWhisk credentials

**Kind**: inner typedef of [<code>types</code>](#module_types)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| namespace | <code>string</code> | user namespace |
| auth | <code>string</code> | auth key |

<a name="module_types..AzureCosmosPartitionResourceCredentials"></a>

### types~AzureCosmosPartitionResourceCredentials : <code>object</code>
An object holding the Azure Cosmos resource credentials with permissions on a single partition and container

**Kind**: inner typedef of [<code>types</code>](#module_types)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| endpoint | <code>string</code> | cosmosdb resource endpoint |
| resourceToken | <code>string</code> | cosmosdb resource token restricted to the partitionKey |
| databaseId | <code>string</code> | id for cosmosdb database |
| containerId | <code>string</code> | id for cosmosdb container within database |
| partitionKey | <code>string</code> | key for cosmosdb partition within container authorized by resource token |

<a name="module_types..AzureCosmosMasterCredentials"></a>

### types~AzureCosmosMasterCredentials : <code>object</code>
An object holding the Azure Cosmos account master key

**Kind**: inner typedef of [<code>types</code>](#module_types)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| endpoint | <code>string</code> | cosmosdb resource endpoint |
| masterKey | <code>string</code> | cosmosdb account masterKey |
| databaseId | <code>string</code> | id for cosmosdb database |
| containerId | <code>string</code> | id for cosmosdb container within database |
| partitionKey | <code>string</code> | key for cosmosdb partition where data will be stored |

<a name="module_types..StateStorePutOptions"></a>

### types~StateStorePutOptions : <code>object</code>
StateStore put options

**Kind**: inner typedef of [<code>types</code>](#module_types)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| ttl | <code>number</code> | time-to-live for key-value pair in seconds, defaults to 24 hours (86400s). Set to < 0 for no expiry. A value of 0 sets default. |

<a name="StateStore"></a>

## *StateStore*
Cloud State Management

**Kind**: global abstract class  

* *[StateStore](#StateStore)*
    * *[.get(key)](#StateStore+get) ⇒ <code>Promise.&lt;any&gt;</code>*
    * *[.put(key, value, [options])](#StateStore+put) ⇒ <code>Promise.&lt;string&gt;</code>*
    * *[.delete(key)](#StateStore+delete) ⇒ <code>Promise.&lt;string&gt;</code>*

<a name="StateStore+get"></a>

### *stateStore.get(key) ⇒ <code>Promise.&lt;any&gt;</code>*
Retrieves the state value for given key.
If the key doesn't exist returns undefined.

**Kind**: instance method of [<code>StateStore</code>](#StateStore)  
**Returns**: <code>Promise.&lt;any&gt;</code> - value stored under key or undefined  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | state key identifier |

<a name="StateStore+put"></a>

### *stateStore.put(key, value, [options]) ⇒ <code>Promise.&lt;string&gt;</code>*
Creates or updates a state key-value pair

**Kind**: instance method of [<code>StateStore</code>](#StateStore)  
**Returns**: <code>Promise.&lt;string&gt;</code> - key  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string</code> |  | state key identifier |
| value | <code>any</code> |  | state value |
| [options] | [<code>StateStorePutOptions</code>](#module_types..StateStorePutOptions) | <code>{}</code> | put options |

<a name="StateStore+delete"></a>

### *stateStore.delete(key) ⇒ <code>Promise.&lt;string&gt;</code>*
Deletes a state key-value pair

**Kind**: instance method of [<code>StateStore</code>](#StateStore)  
**Returns**: <code>Promise.&lt;string&gt;</code> - key  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | state key identifier |

<a name="StateStoreError"></a>

## StateStoreError ⇐ <code>Error</code>
Errors raised by state store lib

**Kind**: global class  
**Extends**: <code>Error</code>  

* [StateStoreError](#StateStoreError) ⇐ <code>Error</code>
    * [.StateStoreError](#StateStoreError.StateStoreError)
        * [new StateStoreError(message, code, [internal])](#new_StateStoreError.StateStoreError_new)
    * [.codes](#StateStoreError.codes) : <code>enum</code>

<a name="StateStoreError.StateStoreError"></a>

### StateStoreError.StateStoreError
**Kind**: static class of [<code>StateStoreError</code>](#StateStoreError)  
<a name="new_StateStoreError.StateStoreError_new"></a>

#### new StateStoreError(message, code, [internal])
Creates an instance of StateStoreError.


| Param | Type | Description |
| --- | --- | --- |
| message | <code>string</code> | error message |
| code | [<code>codes</code>](#StateStoreError.codes) | Storage Error code |
| [internal] | <code>object</code> | debug error object for internal/underlying wrapped errors |

<a name="StateStoreError.codes"></a>

### StateStoreError.codes : <code>enum</code>
StateStoreError codes

**Kind**: static enum of [<code>StateStoreError</code>](#StateStoreError)  
**Properties**

| Name | Type | Default |
| --- | --- | --- |
| Internal | <code>string</code> | <code>&quot;Internal&quot;</code> | 
| NotImplemented | <code>string</code> | <code>&quot;NotImplemented&quot;</code> | 
| BadArgument | <code>string</code> | <code>&quot;BadArgument&quot;</code> | 
| Forbidden | <code>string</code> | <code>&quot;Forbidden&quot;</code> | 
| PayloadTooLarge | <code>string</code> | <code>&quot;PayloadTooLarge&quot;</code> | 

<a name="init"></a>

## init([config]) ⇒ [<code>Promise.&lt;StateStore&gt;</code>](#StateStore)
Initializes and returns the key-value-store SDK.

To use the SDK you must either provide your
[OpenWhisk credentials](#module_types..OpenWhiskCredentials) in
`config.ow` or your own
[Azure Cosmos credentials](#module_types..AzureCosmosMasterCredentials) in `config.cosmos`.

OpenWhisk credentials can also be read from environment variables (`OW_NAMESPACE` or `__OW_NAMESPACE` and `OW_AUTH` or `__OW_AUTH`).

**Kind**: global function  
**Returns**: [<code>Promise.&lt;StateStore&gt;</code>](#StateStore) - A StateStore instance  
**Throws**:

- [<code>StateStoreError</code>](#StateStoreError) 


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [config] | <code>object</code> | <code>{}</code> | used to init the sdk |
| [config.ow] | [<code>OpenWhiskCredentials</code>](#module_types..OpenWhiskCredentials) |  | [OpenWhiskCredentials](#module_types..OpenWhiskCredentials). Set those if you want to use ootb credentials to access the state management service. OpenWhisk namespace and auth can also be passed through environment variables: `__OW_NAMESPACE` and `__OW_AUTH` |
| [config.cosmos] | [<code>AzureCosmosMasterCredentials</code>](#module_types..AzureCosmosMasterCredentials) \| [<code>AzureCosmosPartitionResourceCredentials</code>](#module_types..AzureCosmosPartitionResourceCredentials) |  | [Azure Cosmos resource credentials](#module_types..AzureCosmosPartitionResourceCredentials) or [Azure Cosmos account credentials](#module_types..AzureCosmosMasterCredentials) |
| [config.tvm] | <code>object</code> |  | tvm configuration, applies only when passing OpenWhisk credentials |
| [config.tvm.apiUrl] | <code>string</code> |  | alternative tvm api url. |
| [config.tvm.cacheFile] | <code>string</code> |  | alternative tvm cache file, set to `false` to disable caching of temporary credentials. |

