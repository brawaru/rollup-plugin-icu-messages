export interface API {
  /**
   * Checks whether the provided ID matches the configured filters of the
   * plugin.
   *
   * @param id ID of the module.
   */
  filter(id: string): boolean
}

export function isAPI(value: unknown): value is API {
  return value != null && typeof value === 'object' && 'filter' in value
}
