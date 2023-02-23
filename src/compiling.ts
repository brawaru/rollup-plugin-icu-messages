import { promisify } from 'util'
import { fileURLToPath, pathToFileURL } from 'url'
import { resolve } from 'import-meta-resolve'
import glob_ from 'glob'
import { basename, dirname, extname } from 'pathe'
import type { CompileFn } from '@formatjs/cli-lib'
import type { NormalizedOptions } from './options.js'

const glob = promisify(glob_)

class FormatterResolutionError extends Error {
  public readonly code = 'ROLLUP_ICU_FORMATTER_RESOLVE_ERROR'
}

export async function resolveCompileFunction(
  input: NormalizedOptions['format'],
): Promise<CompileFn> {
  if (typeof input === 'function') return input

  const defaultFormatters = new Map<string, string>()

  let formattersIndexFile: string

  try {
    formattersIndexFile = await resolve(
      '@formatjs/cli-lib/src/formatters/index.js',
      import.meta.url,
    )

    if (formattersIndexFile == null) {
      // eslint-disable-next-line no-throw-literal
      throw `resolving "@formatjs/cli-lib/src/formatters/index.js" returned ${formattersIndexFile}`
    }
  } catch (cause) {
    throw new FormatterResolutionError(
      `Cannot resolve formatters index file: ${String(cause)}`,
      { cause },
    )
  }

  if (formattersIndexFile != null) {
    const cwd = dirname(fileURLToPath(formattersIndexFile))
    const matchingFiles = await glob('*.js', {
      cwd,
      absolute: true,
    })

    for (const formatterFileName of matchingFiles) {
      const formatterName = basename(
        formatterFileName,
        extname(formatterFileName),
      )

      if (formatterFileName === 'index') continue

      defaultFormatters.set(
        formatterName,
        String(pathToFileURL(formatterFileName)),
      )
    }
  }

  const importPath = defaultFormatters.get(input)

  if (importPath == null) {
    throw new FormatterResolutionError(
      `Cannot resolve built-in formatter "${input}". Valid formatters are: ${[
        ...defaultFormatters.keys(),
      ].join(', ')}`,
    )
  }

  defaultFormatters.get(input)!

  let imported: Record<string, unknown>

  try {
    imported = await import(importPath)
  } catch (cause) {
    throw new FormatterResolutionError(
      `Cannot import built-in formatter "${input}" (resolved as "${importPath}"): ${String(
        cause,
      )}`,
      { cause },
    )
  }

  if (typeof imported.compile !== 'function') {
    throw new FormatterResolutionError(
      `Imported formatter "${input}" (resolved as "${importPath}") does not contain a compile function export`,
    )
  }

  return imported.compile as CompileFn
}
