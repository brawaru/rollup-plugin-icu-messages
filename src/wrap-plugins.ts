import type { ObjectHook, Plugin, TransformHook } from 'rollup'
import type { Plugin as VitePlugin } from 'vite'
import { isAPI } from './api.js'
import { basePluginName } from './shared.js'

export type FilterFunction = (id: string) => boolean

export type PluginWrapper<PluginType> = (
  plugin: PluginType,
  filter: FilterFunction,
) => void

type WrappersMap<PluginType> = Record<string, PluginWrapper<PluginType>>

interface Options<PluginType> {
  /** Whether to extend defaults. */
  extendDefaults?: boolean

  /** Map of wrappers. */
  wrappers?: WrappersMap<PluginType>
}

type WarningFunction = (entry: { code: string; message: string }) => void

class APIMissmatchError extends Error {
  public readonly code = 'ROLLUP_ICU_WRAP_API_MISMATCH'
}

function collectFilters(
  plugins: readonly Plugin[] | undefined | null,
  onWarn?: WarningFunction,
): FilterFunction[] {
  const filters: FilterFunction[] = []

  if (Array.isArray(plugins)) {
    for (const plugin of plugins) {
      if (plugin.name === basePluginName) {
        if (!isAPI(plugin.api)) {
          onWarn?.(
            new APIMissmatchError(
              'Skipped a plugin which matches our name, but has invalid API',
            ),
          )

          continue
        }

        filters.push(plugin.api.filter)
      }
    }
  }

  return filters
}

function createMegaFilter(filters: FilterFunction[]): FilterFunction {
  return function anyMatches(id) {
    return filters.some((filter) => filter(id))
  }
}

type WrapperQueryFunction<PluginType> = (
  pluginName: string,
) => PluginWrapper<PluginType> | undefined

class PluginIneffectiveError extends Error {
  public readonly code = 'ROLLUP_ICU_WRAP_USELESS'
}

function isEmptyObject(value?: Record<string, any>): boolean {
  if (value == null) return true

  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) return false
  }

  return true
}

export function wrapTransform(
  plugin: Pick<Plugin, 'transform'>,
  filter: (id: string) => boolean,
) {
  const originalTransform = plugin.transform
  if (originalTransform != null) {
    if (typeof originalTransform === 'object') {
      const handler = originalTransform.handler
      return {
        ...originalTransform,
        handler(code, id) {
          if (filter(id)) return null as ReturnType<TransformHook>

          return handler.call(this, id, code) as ReturnType<TransformHook>
        },
      } satisfies ObjectHook<TransformHook>
    } else {
      plugin.transform = function wrappedTransform(code, id) {
        if (filter(id)) return null

        return originalTransform.call(this, code, id)
      }
    }
  }
}

function createWrapResolver<
  PluginType extends InheritsDefaults extends true
    ? Pick<Plugin, 'transform'>
    : object,
  InheritsDefaults extends boolean = true,
>(
  wrappers?: WrappersMap<PluginType>,
  inheritDefaults?: InheritsDefaults,
  onWarn?: WarningFunction,
): WrapperQueryFunction<PluginType> {
  inheritDefaults ??= true as InheritsDefaults

  if (!inheritDefaults && isEmptyObject(wrappers)) {
    onWarn?.(
      new PluginIneffectiveError(
        'Your configuration does not make use of defaults and does not provide any other wrappers. This transform wrap plugin will be ineffective and probably could be removed.',
      ),
    )

    return function dummyResolver() {
      return undefined
    }
  }

  const defaults: WrappersMap<PluginType> | null = inheritDefaults
    ? {
        json: wrapTransform,
        'vite:json': wrapTransform,
      }
    : null

  return function resolveWrapper(pluginName) {
    return wrappers?.[pluginName] ?? defaults?.[pluginName]
  }
}

class PluginsFieldEmpty extends Error {
  public readonly code = 'ROLLUP_ICU_WRAP_NO_PLUGINS'
}

function wrappingImpl<PluginType extends Plugin>(
  plugins: readonly PluginType[],
  options: Options<PluginType> | undefined,
  onWarn: WarningFunction,
) {
  if (plugins == null || (Array.isArray(plugins) && plugins.length === 0)) {
    onWarn(
      new PluginsFieldEmpty(
        'Your Rollup configuration does not include any plugins',
      ),
    )

    return
  }

  const resolveWrapper = createWrapResolver(
    options?.wrappers,
    options?.extendDefaults,
    onWarn,
  )

  const filter = createMegaFilter(collectFilters(plugins, onWarn))

  for (const plugin of plugins) {
    const wrap = resolveWrapper(plugin.name)

    if (wrap != null) wrap(plugin, filter)
  }
}

export function icuMessagesWrapPlugins(options?: Options<Plugin>): Plugin {
  return {
    name: `${basePluginName}:plugins-wrapper`,
    buildStart({ plugins }) {
      wrappingImpl(plugins, options, this.warn)
    },
  }
}

export function icuMessagesWrapPluginsVite(
  options?: Options<VitePlugin>,
): VitePlugin {
  const name = `${basePluginName}:plugins-wrapper-vite`
  return {
    name,
    configResolved({ plugins }) {
      wrappingImpl(plugins, options, (logEntry) => {
        // eslint-disable-next-line no-console
        console.warn(`[${name}] ${logEntry.code}: ${logEntry.message}`)
      })
    },
  }
}
