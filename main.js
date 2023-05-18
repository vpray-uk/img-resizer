const Jimp = require("jimp");
const conf = require("./settings.json");
const fs = require("fs");
const path = require("path");

function getCurrentDirectory() {
  return process.cwd();
}

function combinePaths(...segments) {
  return path.join(...segments);
}

function directoryExists(path) {
  try {
    fs.accessSync(combinePaths(getCurrentDirectory(), path), fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
}

function fileExists(path) {
  try {
    fs.accessSync(path, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
}

function getFileNamesFromDirectory(directoryPath) {
  try {
    const fileNames = fs.readdirSync(directoryPath);
    return fileNames;
  } catch (err) {
    console.error("Error reading directory:", err);
    return [];
  }
}

if (!directoryExists(conf.inputPath)) {
  console.error(
    "input file directory not found: " +
      combinePaths(getCurrentDirectory(), conf.inputPath)
  );
  process.exit(1);
}

if (!directoryExists(conf.outputPath)) {
  console.error(
    "output file directory not found: " +
      combinePaths(getCurrentDirectory(), conf.outputPath)
  );
  process.exit(1);
}

if (!fileExists(combinePaths(getCurrentDirectory(), conf.watermarkLogoFile))) {
  console.error(
    "logo file not found: " +
      combinePaths(getCurrentDirectory(), conf.watermarkLogoFile)
  );
  process.exit(1);
}

let inputImages = getFileNamesFromDirectory(
  combinePaths(getCurrentDirectory(), conf.inputPath)
);

console.log("Input image found: " + inputImages.length);
for (let img of inputImages) {
  const inputFile = combinePaths(getCurrentDirectory(), conf.inputPath, img);
  const outputFile = combinePaths(getCurrentDirectory(), conf.outputPath, img);
  const resizeSize = parseInt(conf.images.resizeSize, 10);
  const outputSize = parseInt(conf.images.outputSize, 10);
  const logoFile = combinePaths(getCurrentDirectory(), conf.watermarkLogoFile);

  console.log("Working on " + img + " ..");
  // Part 1: increaseCanvas.js
  Jimp.read(inputFile, (err, inputImage) => {
    if (err) throw err;

    const outputImage = new Jimp(resizeSize, resizeSize, 0xffffffff);
    outputImage.composite(
      inputImage,
      (resizeSize - inputImage.bitmap.width) / 2,
      (resizeSize - inputImage.bitmap.height) / 2
    );

    outputImage.write(outputFile, (err) => {
      if (err) throw err;

      // Part 2: resize.js
      Jimp.read(outputFile, (err, resizedImage) => {
        if (err) throw err;

        resizedImage.resize(outputSize, outputSize);
        resizedImage.write(outputFile, (err) => {
          if (err) throw err;

          // Part 3: addlogo.js
          const main = async (a) => {
            const [image, logo] = await Promise.all([
              Jimp.read(a),
              Jimp.read(logoFile),
            ]);

            logo.resize(logo.bitmap.width, Jimp.AUTO);

            const X = image.bitmap.width - logo.bitmap.width - 10;
            const Y = image.bitmap.height - logo.bitmap.height - 10;

            return image.composite(logo, X, Y, [
              {
                mode: Jimp.BLEND_SCREEN,
                opacitySource: conf.watermark.opacity,
                opacityDest: 1,
              },
            ]);
          };

          main(outputFile).then((image) => image.write(outputFile));
        });
      });
    });
  });
}
