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

function directoryExists(directoryPath) {
  try {
    fs.accessSync(directoryPath, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
}

function createDirectoryIfNotExists(directoryPath) {
  if (!directoryExists(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
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

const inputPath = combinePaths(getCurrentDirectory(), conf.inputPath);
const outputPath = combinePaths(getCurrentDirectory(), conf.outputPath);
const logoFilePath = combinePaths(getCurrentDirectory(), conf.watermarkLogoFile);

if (!directoryExists(inputPath)) {
  console.error("Input file directory not found: " + inputPath);
  process.exit(1);
}

createDirectoryIfNotExists(outputPath);

if (!fileExists(logoFilePath)) {
  console.error("Logo file not found: " + logoFilePath);
  process.exit(1);
}

let inputImages = getFileNamesFromDirectory(inputPath);

console.log("Input images found: " + inputImages.length);
for (let img of inputImages) {
  const inputFile = combinePaths(inputPath, img);
  const outputFile = combinePaths(outputPath, img);
  const resizeSize = parseInt(conf.images.resizeSize, 10);
  const outputSize = parseInt(conf.images.outputSize, 10);

  console.log("Working on " + img + " ..");
  
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

      Jimp.read(outputFile, (err, resizedImage) => {
        if (err) throw err;

        resizedImage.resize(outputSize, outputSize);
        resizedImage.write(outputFile, (err) => {
          if (err) throw err;

          const main = async (a) => {
            const [image, logo] = await Promise.all([
              Jimp.read(a),
              Jimp.read(logoFilePath),
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
