# rollup-plugin-icu-messages

> Transform files containing ICU MessageFormat messages.

## Summary

This Rollup plugin adds a transform hook that pre-parses all messages in the JSON file into an AST that can be used at runtime without the need to bring in a parser, allowing the bundle size to be reduced. Read more about how this works on the [Format.JS website →](https://formatjs.io/docs/guides/advanced-usage#pre-compiling-messages)

## Installation

With package manager of your choice:

**npm**

```sh
npm i -D @braw/rollup-plugin-icu-messages
```

**yarn**

```sh
yarn add -D @braw/rollup-plugin-icu-messages
```

**pnpm**

```sh
pnpm i -D @braw/rollup-plugin-icu-messages
```

## Usage

In your Rollup file, import the default export from the `@braw/rollup-plugin-icu-messages` and then use it as a function in your `plugins` config array.

Example configuration:

```ts
import { defineConfig } from 'rollup'
import { icuMessages } from '@braw/rollup-plugin-icu-messages'

export default defineConfig({
  input: './src/index.mjs',
  output: { dir: './dist' },
  plugins: [
    icuMessages({
      include: './i18n/*.json',
      format: 'crowdin',
    }),
  ],
})
```

The following options are supported:

- `include` (optional, default: `'**/*.messages.json'`) — either a single glob string or regular expression, or an array of them, which must match the file IDs to be included in the transformation.
- `exclude` (optional, default: `undefined`) — either a single glob string or regular expression, or an array of them, which must match the file IDs to be excluded from the transformation.
- `indent` (optional, default: `'\t'`) — string or a number of spaces used for indentation.
- `parse` (optional, default: `(code) => JSON.parse(code)`) — a function that takes the file content and ID, parses it and returns the JS object to pass to the `format` function.
- `format` (optional, default: `default`) — either a string with the name of the built-in formatter, or a function that accepts parsed file contents (using the `parse` function) and produces a record of messages, keyed by their IDs. For a list of built-in formatters, [see the @formatjs/cli documentation →](https://formatjs.io/docs/tooling/cli#builtin-formatters).
- `parserOptions` (optional, default: `undefined`) — an object whose keys are message IDs and whose values are either parsing options for those messages or a function that generates parsing options based on contextual information (such as module ID, message ID, and all messages).

## Usage with other JSON plugins

Your configuration may already include a plugin that handles JSON or other files that may conflict with this plugin.

You can configure this plugin to include files with other extensions and store your messages in, e.g. `.messages` files. Just change `options.include` to `**/*.messages` in this case.

Alternatively you can use a separate plugin in this package — `icuMessagesWrapPlugins`, exported from `@braw/rollup-plugin-icu-messages/wrap-plugins`. If you use Vite, there is also `icuMessagesWrapPluginsVite`.

<details>
<summary>Example configuration</summary>

```ts
import { defineConfig } from 'rollup'
import json from '@rollup/plugin-json'
import { icuMessages } from '@braw/rollup-plugin-icu-messages'
import { icuMessagesWrapPlugins } from '@braw/rollup-plugin-icu-messages/wrap-plugins'

export default defineConfig({
  input: './src/index.mjs',
  output: { dir: './dist' },
  plugins: [
    json(),
    icuMessages({
      include: './i18n/*.json',
      format: 'crowdin',
    }),
    icuMessagesWrapPlugins({
      extendDefaults: true,
      wrappers: {
        'my-plugin'(plugin, filter) {
          // implement plugin wrapping here
          // use filter to check if the file is handled by icuMessages plugin
        },
      },
    }),
  ],
})
```

</details>
