import type { ColorSchemeModes, DesignToken, PinceauContext, PinceauMediaQueries } from '../types'
import { pathToVarName } from './$tokens'
import { DARK, INITIAL, LIGHT, referencesRegex } from './regexes'

/**
 * Resolve a css function property to a stringifiable declaration.
 */
export function resolveCssProperty(
  property: any,
  value: any,
  style: any,
  selectors: any,
  localTokens: string[] = [],
  ctx: PinceauContext,
  loc?: any,
) {
  // Resolve custom style directives
  const directive = resolveCustomDirectives(property, value, selectors, ctx, loc)
  if (directive) { return directive }

  // Resolve custom properties
  if (ctx?.utils?.[property]) {
    // Custom property is a function, pass value and return result
    if (typeof ctx.utils[property] === 'function') { return ctx.utils[property](value) }

    // Custom property is an object, if value is true, return result
    return value ? ctx.utils[property] : {}
  }

  // Resolve final value
  value = castValues(property, value, localTokens, ctx, loc)

  // Return proper declaration
  return {
    [property]: value,
  }
}

/**
 * Cast value or values before pushing it to the style declaration
 */
export function castValues(
  property: any,
  value: any,
  localTokens: string[],
  ctx: PinceauContext,
  loc?: any,
) {
  if (Array.isArray(value) || typeof value === 'string' || typeof value === 'number') {
    if (Array.isArray(value)) {
      value = value.map(v => castValue(property, v, localTokens, ctx, loc)).join(',')
    }
    else {
      value = castValue(property, value, localTokens, ctx, loc)
    }
  }
  return value
}

/**
 * Cast a value to a valid CSS unit.
 */
export function castValue(
  property: any,
  value: any,
  localTokens: string[],
  ctx: PinceauContext,
  loc?: any,
) {
  if (typeof value === 'number') { return value }

  if (value.match(referencesRegex)) { value = resolveReferences(property, value, localTokens, ctx, loc) }

  if (value === '{}') { return '' }

  return value
}

/**
 * Resolve token references
 */
export function resolveReferences(
  _: string,
  value: string,
  localTokens: string[],
  ctx: PinceauContext,
  loc?: any,
) {
  if (!(typeof value === 'string')) { return value }

  value = value.replace(
    referencesRegex,
    (_, tokenPath) => {
      const varName = pathToVarName(tokenPath)
      const variable = `var(${varName})`

      if (localTokens.includes(varName)) { return variable }

      const token = ctx.$tokens(tokenPath, { key: undefined, loc }) as DesignToken

      const tokenValue = typeof token === 'string' ? token : (token?.variable || token?.value)

      // Fallback if value does not exist
      if (!tokenValue) { return variable }

      return tokenValue as string
    },
  )

  return value
}

/**
 * Resolve custom directives (@mq, @dark).
 */
export function resolveCustomDirectives(
  property: any,
  value: any,
  selectors: any,
  ctx: PinceauContext,
  loc?: any,
) {
  if (property.startsWith('@')) {
    const resolveColorScheme = (scheme: string) => {
      scheme = ctx.options.colorSchemeMode === 'class'
        ? `:root.${scheme}`
        : `@media (prefers-color-scheme: ${scheme})`

      const isMedia = scheme.startsWith('@media')

      // Runtime styling needs to be wrapped in `@media` as it does not get processed through PostCSS
      if (ctx?.runtime) {
        return {
          '@media': {
            [scheme]: value,
          },
        }
      }

      return {
        [isMedia ? scheme : `${scheme} &`]: value,
      }
    }

    // @dark
    if (property === DARK) { return resolveColorScheme('dark') }

    // @light
    if (property === LIGHT) { return resolveColorScheme('light') }

    // @initial
    if (property === INITIAL) {
      const token = ctx.$tokens('media.initial' as any, { key: 'value', onNotFound: false, loc })
      return {
        [`@media${token ? ` ${token}` : ''}`]: value,
      }
    }

    // Handle all user supplied @directives
    const mediaQueries = ctx.$tokens('media' as any, { key: undefined, loc })
    if (mediaQueries) {
      const query = property.replace('@', '')
      if (mediaQueries[query]) {
        return {
          [`@media ${mediaQueries[query].value}`]: value,
        }
      }
    }

    return {
      [property]: value,
    }
  }
}

/**
 * Return a theme rule from a media query key, some content and a theme.
 */
export function resolveThemeRule(
  mq: PinceauMediaQueries,
  content?: string,
  theme?: any,
  colorSchemeMode?: ColorSchemeModes,
) {
  let responsiveSelector = ''
  if (mq === 'dark' || mq === 'light') {
    if (colorSchemeMode === 'class') { responsiveSelector = `:root.${mq}` }
    else { responsiveSelector = `(prefers-color-scheme: ${mq})` }
  }
  else if (mq !== 'initial' && theme) {
    const queryToken = theme?.media?.[mq]
    if (queryToken) { responsiveSelector = queryToken.value }
  }
  let prefix
  if (!responsiveSelector) { prefix = '@media { :root {' }
  else if (responsiveSelector.startsWith('.')) { prefix = `@media { :root${responsiveSelector} {` }
  else if (responsiveSelector.startsWith(':root')) { prefix = `@media { ${responsiveSelector} {` }
  else { prefix = `@media ${responsiveSelector} { :root {` }
  return `${`${`${prefix}--pinceau-mq: ${String(mq)}; ${content}`} } }`}\n`
}
