# Pixel Density Image Loader

A webpack loader for images with pixel density descriptor in filenames (`@2x`, `@3x` and so on). Automatically resizes the biggest image and produces `srcset` attribute.

## Install

```
npm i pixel-density-image-loader --save-dev
```

## Usage

Change your `webpack.config.js` and add a rule for images.

```javascript
module.exports = {
  // ...
  module: {
    rules: [
      {
        test: /\.(jpe?g|png)$/i,
        loader: 'pixel-density-image-loader ',
        options: {
          // turn on to generate React <img> elements
          // imageElement: true
        }
      }
    ]
  },
}
```

Then import your images:

```javacript
const image = require('./logo@3x.jpg')

// image.default = 'f1913e617626190b25d2dfd2a1d8f320-1.jpg'
// image.src = 'f1913e617626190b25d2dfd2a1d8f320-1.jpg'
// image.srcSet = 'f1913e617626190b25d2dfd2a1d8f320-3.jpg 3x, f1913e617626190b25d2dfd2a1d8f320-2.jpg 2x, f1913e617626190b25d2dfd2a1d8f320-1.jpg 1x'
// image.width = 600
// image.height = 200

// when imageElement is true
// image.ImageElement = (...args) => <img src={} srcSet={} width={} height={} {...args} />
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ImageElement` | `boolean` | `false` | Generates img React element |
