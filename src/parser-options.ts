import type { ParserOptions } from '@formatjs/icu-messageformat-parser/parser.js'

export const AnyMessage = Symbol('defaultParserOptions')

/**
 * Represents a custom options resolving function.
 *
 * The function is called with `this` set to a {@link ResolverContext} object.
 *
 * @example
 *   const skipParsingTags = function () {
 *     return {
 *       ...this.getDefaultOptions(),
 *       tags: false,
 *     }
 *   }
 *
 * @param messageId Identifier of the message for which the resolver is called.
 * @returns Options to use, `undefined` (nothing also counts as `undefined`) to
 *   use default options, `null` to not use any parsing options.
 */
export type CustomOptionsResolver = (
  this: ResolverContext,
  messageId: string,
) => ParserOptions | null | undefined | void

export type MessagesParsingOptions =
  | {
      [K in string | typeof AnyMessage]?: ParserOptions | CustomOptionsResolver
    }
  | CustomOptionsResolver

export type OptionsResolver = (
  moduleId: string,
  messageId: string,
  messages: Record<string, string>,
) => ParserOptions | undefined

export interface ResolverContext {
  /** ID of the file. */
  readonly moduleId: string

  /** Compiled messages map. */
  readonly messages: Record<string, string>

  /** Returns options provided by the default resolver. */
  getDefaultOptions(): ParserOptions | undefined
}

function resolveOptionsWithResolver(
  resolver: ParserOptions | CustomOptionsResolver | undefined,
  ...resolverArgs:
    | Parameters<OptionsResolver>
    | [...Parameters<OptionsResolver>, CustomOptionsResolver | undefined]
): ParserOptions | undefined {
  const [moduleId, messageId, messages, defaultResolver] = resolverArgs

  let cachedDefaultOptions: { value: ParserOptions | undefined } | undefined

  function getDefaultOptions() {
    if (defaultResolver == null) return undefined

    if (cachedDefaultOptions == null) {
      cachedDefaultOptions = {
        value: resolveOptionsWithResolver(
          defaultResolver,
          moduleId,
          messageId,
          messages,
        ),
      }
    }

    return cachedDefaultOptions.value
  }

  if (resolver == null) return getDefaultOptions()

  if (typeof resolver === 'function') {
    const options = resolver.call(
      {
        get moduleId() {
          return moduleId
        },
        get messages() {
          return messages
        },
        getDefaultOptions,
      },
      messageId,
    )

    return options === null ? undefined : options ?? getDefaultOptions()
  }

  return resolver
}

export function createOptionsResolver(
  options?: MessagesParsingOptions,
  defaultResolver?: CustomOptionsResolver,
): OptionsResolver {
  if (options == null) {
    return function callDefaultResolver(moduleId, messageId, messages) {
      return resolveOptionsWithResolver(
        defaultResolver,
        moduleId,
        messageId,
        messages,
      )
    }
  }

  if (typeof options === 'function') {
    return function callRootResolver(moduleId, messageId, messages) {
      return resolveOptionsWithResolver(
        options,
        moduleId,
        messageId,
        messages,
        defaultResolver,
      )
    }
  }

  const normalizedOptions = new Map<
    string | typeof AnyMessage,
    ParserOptions | CustomOptionsResolver
  >()

  const globalOptionsResolver: CustomOptionsResolver =
    function resolveGlobalOptions(messageId) {
      return resolveOptionsWithResolver(
        normalizedOptions.get(AnyMessage),
        this.moduleId,
        messageId,
        this.messages,
        defaultResolver,
      )
    }

  if (options[AnyMessage] != null) {
    normalizedOptions.set(AnyMessage, options[AnyMessage])
  }

  for (const [messageId, parserOptions] of Object.entries(options)) {
    if (parserOptions != null) normalizedOptions.set(messageId, parserOptions)
  }

  return function resolve(moduleId, messageId, messages) {
    return resolveOptionsWithResolver(
      normalizedOptions.get(messageId),
      moduleId,
      messageId,
      messages,
      globalOptionsResolver,
    )
  }
}
