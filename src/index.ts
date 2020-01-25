import * as path from 'path'
import * as webpack from 'webpack'
import * as loaderUtils from 'loader-utils'
import validateOptions from 'schema-utils'
import { JSONSchema7 } from 'json-schema'
import sharp from 'sharp'

type FilesByRatio = Map<number, Buffer>

interface FileResult {
  name: string
  ext: string
  width: number
  height: number
  files: FilesByRatio
}

type Versions = Map<number, Version>

interface Version {
  buffer: Buffer
  name: string
  width: number
  height: number
}

const parseFile = async (resourcePath: string): Promise<FileResult> => {
  const files = new Map<number, Buffer>()

  const image = sharp(resourcePath)
  const metadata = await image.metadata()
  let width = metadata.width || 0
  let height = metadata.height || 0

  const { name, ext } = path.parse(resourcePath)
  const ratio = parseFloat((/@(\d+(\.\d+)?)x/.exec(name) || [])[1])
  if (Number.isFinite(ratio)) {
    width /= ratio
    height /= ratio
    const range = Array.from({ length: Math.floor(ratio) }, (_, i) => i + 1)
    if (Math.floor(ratio) !== ratio) range.push(ratio)
    await Promise.all(range.map(async (newRatio) => {
      const newBuffer = newRatio === ratio
        ? await image.toBuffer()
        : await image.clone().resize(width * newRatio, height * newRatio).toBuffer()
      files.set(newRatio, newBuffer)
    }))
  } else {
    const buffer = await image.toBuffer()
    files.set(1, buffer)
  }

  return { name, ext, width, height, files }
}

const getVersions = (url: string, { ext, width, height, files }: FileResult): Versions => {
  const versions = new Map<number, Version>()

  files.forEach((buffer, ratio) => {
    versions.set(ratio, {
      buffer,
      name: `${url}-${ratio}${ext}`,
      width: width * ratio,
      height: height * ratio,
    })
  })

  return versions
}

const getPublicPath = (url: string): string => `__webpack_public_path__ + ${JSON.stringify(url)}`

const produceResultFile = (versions: Versions, config: loaderUtils.OptionObject): string => {
  let result = ''

  // base url
  const base = versions.get(1)
  if (base) {
    result += `export default ${getPublicPath(base.name)}\n`
    result += `export const src = ${getPublicPath(base.name)}\n`
    result += `export const width = ${base.width}\n`
    result += `export const height = ${base.height}\n`
  }

  // srcSet
  const srcSetArray = Array.from(versions.entries()).map(([ratio, version]) => `\${${getPublicPath(version.name)}} ${ratio}x`)
  const srcSet = `\`${srcSetArray.join(', ')}\``
  if (srcSet) {
    result += `export const srcSet = ${srcSet}\n`
  }

  // imageElement
  if (config.imageElement && base) {
    result += "import React from 'react'\n"
    result += `export const ImageElement = (args) => \
React.createElement('img', { src: ${getPublicPath(base.name)}, srcSet: ${srcSet}, \
width: ${base.width}, height: ${base.height}, \
...args })`
  }

  return result
}

const schema: JSONSchema7 = {
  type: 'object',
  additionalProperties: false,
  properties: {
    imageElement: {
      description: 'Produces HTMLImageElement for React',
      type: 'boolean',
    },
  },
}

export default async function (this: webpack.loader.LoaderContext, content: Buffer): Promise<void> {
  this.cacheable()
  const callback = this.async() as webpack.loader.loaderCallback
  const query = this.resourceQuery ? loaderUtils.parseQuery(this.resourceQuery) : {}
  const options = loaderUtils.getOptions(this) || {}
  const config = { ...options, ...query }
  try {
    validateOptions(schema, config, {
      name: 'Pixel Density Image Loader',
      baseDataPath: 'options',
    })
    const context = options.context || this.rootContext
    const url = loaderUtils.interpolateName(
      this,
      '[contenthash]',
      {
        context,
        content,
      },
    )

    const result = await parseFile(this.resourcePath)
    const versions = getVersions(url, result)

    versions.forEach(({ name, buffer }) => {
      this.emitFile(name, buffer, null)
    })

    callback(null, produceResultFile(versions, config))
  } catch (error) {
    callback(error)
  }
}
