## img-resizer
This script enables batch processing of images by adjusting canvas size, resizing them, and adding a watermark logo. It is designed for individuals who possess numerous images of varying sizes and wish to make them uniform in terms of dimensions.

Make sure to config the settings.json properly. All the related folders and a logo must be at the same level of the module.

Requires Node.js to run.
Please download and install NodeJS first: https://nodejs.org/en

# Usage
```javascript
npm run start
```

# Build to an executable
```javascript
npm run build
```

# settings.json
```
{
  "inputPath": "./input-images/",
  "outputPath": "./output-images/",
  "watermarkLogoFile": "./logo.png",
  "images": {
    "resizeSize": 2048,
    "outputSize": 2048
  },
  "watermark": {
    "opacity": 1
  }
}
```

inputPath - the input folder that contains the images that need to be processed.
outputPath - the output folder of the processed images.
watermarkLogoFile - the watermark image path.
images.resizeSize - the size of the image before stamping the watermark.
images.outputSize - the final image size with the watermark stamped.
watermark.opacity - how transparent the watermark should be.