const Jimp = require("jimp");
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
    return fileNames.filter(name => !name.endsWith('.ini'));
  } catch (err) {
    console.error("Error reading directory:", err);
    return [];
  }
}

async function processImages(settings) {
  return new Promise((resolve, reject) => {
    const inputPath = settings.inputPath;
    const outputPath = settings.outputPath;
    const logoFilePath = settings.watermarkLogoFile;

    if (!directoryExists(inputPath)) {
      reject(new Error("Input directory not found: " + inputPath));
      return;
    }

    createDirectoryIfNotExists(outputPath);

    if (!fileExists(logoFilePath)) {
      reject(new Error("Logo file not found: " + logoFilePath));
      return;
    }

    let inputImages = getFileNamesFromDirectory(inputPath);
    let processedCount = 0;
    let totalImages = inputImages.length;

    if (totalImages === 0) {
      resolve({ success: true, message: "No images found to process" });
      return;
    }

    const results = {
      success: true,
      processed: 0,
      total: totalImages,
      errors: []
    };

    for (let img of inputImages) {
      const inputFile = combinePaths(inputPath, img);
      const outputFile = combinePaths(outputPath, img);
      const resizeSize = parseInt(settings.images.resizeSize, 10);
      const outputSize = parseInt(settings.images.outputSize, 10);

      try {
        Jimp.read(inputFile, (err, inputImage) => {
          if (err) {
            results.errors.push({ file: img, error: err.message });
            processedCount++;
            
            if (processedCount === totalImages) {
              resolve(results);
            }
            return;
          }

          const outputImage = new Jimp(resizeSize, resizeSize, 0xffffffff);
          outputImage.composite(
            inputImage,
            (resizeSize - inputImage.bitmap.width) / 2,
            (resizeSize - inputImage.bitmap.height) / 2
          );

          outputImage.write(outputFile, (err) => {
            if (err) {
              results.errors.push({ file: img, error: err.message });
              processedCount++;
              
              if (processedCount === totalImages) {
                resolve(results);
              }
              return;
            }

            Jimp.read(outputFile, (err, resizedImage) => {
              if (err) {
                results.errors.push({ file: img, error: err.message });
                processedCount++;
                
                if (processedCount === totalImages) {
                  resolve(results);
                }
                return;
              }

              resizedImage.resize(outputSize, outputSize);
              resizedImage.write(outputFile, (err) => {
                if (err) {
                  results.errors.push({ file: img, error: err.message });
                  processedCount++;
                  
                  if (processedCount === totalImages) {
                    resolve(results);
                  }
                  return;
                }

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
                      opacitySource: settings.watermark.opacity,
                      opacityDest: 1,
                    },
                  ]);
                };

                main(outputFile)
                  .then((image) => {
                    image.write(outputFile, (err) => {
                      if (err) {
                        results.errors.push({ file: img, error: err.message });
                      } else {
                        results.processed++;
                      }
                      
                      processedCount++;
                      
                      if (processedCount === totalImages) {
                        resolve(results);
                      }
                    });
                  })
                  .catch((err) => {
                    results.errors.push({ file: img, error: err.message });
                    processedCount++;
                    
                    if (processedCount === totalImages) {
                      resolve(results);
                    }
                  });
              });
            });
          });
        });
      } catch (error) {
        results.errors.push({ file: img, error: error.message });
        processedCount++;
        
        if (processedCount === totalImages) {
          resolve(results);
        }
      }
    }
  });
}

async function generatePreview(settings) {
  return new Promise(async (resolve, reject) => {
    try {
      const inputPath = settings.inputPath;
      const logoFilePath = settings.watermarkLogoFile;

      if (!directoryExists(inputPath)) {
        reject(new Error("Input directory not found"));
        return;
      }

      if (!fileExists(logoFilePath)) {
        reject(new Error("Logo file not found"));
        return;
      }

      // Get first image from input directory
      const inputImages = getFileNamesFromDirectory(inputPath);
      const imageFiles = inputImages.filter(img => 
        /\.(jpg|jpeg|png|gif|bmp)$/i.test(img)
      );

      if (imageFiles.length === 0) {
        reject(new Error("No image files found"));
        return;
      }

      const sampleImage = combinePaths(inputPath, imageFiles[0]);
      const resizeSize = parseInt(settings.images.resizeSize, 10);
      const outputSize = parseInt(settings.images.outputSize, 10);

      // Process sample image
      const inputImage = await Jimp.read(sampleImage);
      const outputImage = new Jimp(resizeSize, resizeSize, 0xffffffff);
      
      outputImage.composite(
        inputImage,
        (resizeSize - inputImage.bitmap.width) / 2,
        (resizeSize - inputImage.bitmap.height) / 2
      );

      // Resize to output size
      outputImage.resize(outputSize, outputSize);

      // Add watermark
      const logo = await Jimp.read(logoFilePath);
      logo.resize(logo.bitmap.width, Jimp.AUTO);

      const X = outputImage.bitmap.width - logo.bitmap.width - 10;
      const Y = outputImage.bitmap.height - logo.bitmap.height - 10;

      const finalImage = outputImage.composite(logo, X, Y, [
        {
          mode: Jimp.BLEND_SCREEN,
          opacitySource: settings.watermark.opacity,
          opacityDest: 1,
        },
      ]);

      // Convert to base64
      finalImage.getBase64(Jimp.MIME_PNG, (err, base64) => {
        if (err) {
          reject(err);
        } else {
          resolve({ 
            success: true, 
            preview: base64,
            filename: imageFiles[0]
          });
        }
      });

    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { processImages, generatePreview };