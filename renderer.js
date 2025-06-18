const { ipcRenderer } = require('electron');

// Load settings on startup
window.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    setupSliders();
});

function setupSliders() {
    // Setup all sliders with real-time updates
    const sliders = [
        { slider: 'resizeSize', display: 'resizeSizeValue' },
        { slider: 'outputSize', display: 'outputSizeValue' },
        { slider: 'watermarkOpacity', display: 'opacityValue' }
    ];

    sliders.forEach(({ slider, display }) => {
        const sliderElement = document.getElementById(slider);
        const displayElement = document.getElementById(display);
        
        sliderElement.addEventListener('input', (e) => {
            displayElement.textContent = e.target.value;
            updatePreview();
        });
    });

    // Setup file selection listeners
    ['inputPath', 'outputPath', 'watermarkLogoFile'].forEach(id => {
        document.getElementById(id).addEventListener('change', updatePreview);
    });
}

async function loadSettings() {
    try {
        const settings = await ipcRenderer.invoke('load-settings');
        if (settings) {
            document.getElementById('inputPath').value = settings.inputPath || '';
            document.getElementById('outputPath').value = settings.outputPath || '';
            document.getElementById('watermarkLogoFile').value = settings.watermarkLogoFile || '';
            
            if (settings.images) {
                document.getElementById('resizeSize').value = settings.images.resizeSize || 1024;
                document.getElementById('outputSize').value = settings.images.outputSize || 800;
            }
            
            if (settings.watermark) {
                const opacity = settings.watermark.opacity || 0.7;
                document.getElementById('watermarkOpacity').value = opacity;
                document.getElementById('opacityValue').textContent = opacity;
            }
            
            // Update slider displays
            document.getElementById('resizeSizeValue').textContent = document.getElementById('resizeSize').value;
            document.getElementById('outputSizeValue').textContent = document.getElementById('outputSize').value;
            
            // Initial preview update
            setTimeout(updatePreview, 100);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function saveSettings() {
    const settings = {
        inputPath: document.getElementById('inputPath').value,
        outputPath: document.getElementById('outputPath').value,
        watermarkLogoFile: document.getElementById('watermarkLogoFile').value,
        images: {
            resizeSize: document.getElementById('resizeSize').value,
            outputSize: document.getElementById('outputSize').value
        },
        watermark: {
            opacity: parseFloat(document.getElementById('watermarkOpacity').value)
        }
    };

    try {
        const result = await ipcRenderer.invoke('save-settings', settings);
        if (!result.success) {
            throw new Error(result.error);
        }
        return settings;
    } catch (error) {
        console.error('Error saving settings:', error);
        throw error;
    }
}

async function selectInputFolder() {
    try {
        const folderPath = await ipcRenderer.invoke('select-input-folder');
        if (folderPath) {
            document.getElementById('inputPath').value = folderPath;
            updatePreview();
        }
    } catch (error) {
        console.error('Error selecting input folder:', error);
    }
}

async function selectOutputFolder() {
    try {
        const folderPath = await ipcRenderer.invoke('select-output-folder');
        if (folderPath) {
            document.getElementById('outputPath').value = folderPath;
        }
    } catch (error) {
        console.error('Error selecting output folder:', error);
    }
}

async function selectWatermarkFile() {
    try {
        const filePath = await ipcRenderer.invoke('select-watermark-file');
        if (filePath) {
            document.getElementById('watermarkLogoFile').value = filePath;
            updatePreview();
        }
    } catch (error) {
        console.error('Error selecting watermark file:', error);
    }
}

function addLog(message, type = 'info') {
    const logBox = document.getElementById('logBox');
    const logEntry = document.createElement('div');
    logEntry.className = type === 'error' ? 'log-error' : type === 'success' ? 'log-success' : '';
    logEntry.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
    logBox.appendChild(logEntry);
    logBox.scrollTop = logBox.scrollHeight;
}

function showProgress() {
    document.getElementById('progressContainer').style.display = 'block';
    document.getElementById('logContainer').style.display = 'block';
    document.getElementById('processBtn').disabled = true;
    document.getElementById('processBtn').textContent = 'Processing...';
}

function hideProgress() {
    document.getElementById('progressContainer').style.display = 'none';
    document.getElementById('processBtn').disabled = false;
    document.getElementById('processBtn').textContent = '🚀 Process Images';
}

function updateProgress(processed, total) {
    const percentage = Math.round((processed / total) * 100);
    document.getElementById('progressFill').style.width = `${percentage}%`;
    document.getElementById('progressText').textContent = `Processed ${processed} of ${total} images (${percentage}%)`;
}

async function processImages() {
    try {
        // Validate inputs
        const inputPath = document.getElementById('inputPath').value;
        const outputPath = document.getElementById('outputPath').value;
        const watermarkFile = document.getElementById('watermarkLogoFile').value;

        if (!inputPath || !outputPath || !watermarkFile) {
            alert('Please select input folder, output folder, and watermark file.');
            return;
        }

        // Clear previous logs
        document.getElementById('logBox').innerHTML = '';
        
        // Show progress
        showProgress();
        addLog('Starting image processing...', 'info');

        // Save settings first
        const settings = await saveSettings();
        addLog('Settings saved successfully', 'success');

        // Process images
        const result = await ipcRenderer.invoke('process-images', settings);

        if (result.success) {
            updateProgress(result.processed, result.total);
            
            if (result.processed > 0) {
                addLog(`Successfully processed ${result.processed} images`, 'success');
            } else {
                addLog('No images were processed', 'info');
            }

            if (result.errors && result.errors.length > 0) {
                addLog(`${result.errors.length} errors occurred:`, 'error');
                result.errors.forEach(error => {
                    addLog(`Error processing ${error.file}: ${error.error}`, 'error');
                });
            }

            addLog('Image processing completed!', 'success');
        } else {
            addLog(`Processing failed: ${result.error}`, 'error');
        }

    } catch (error) {
        console.error('Error processing images:', error);
        addLog(`Error: ${error.message}`, 'error');
    } finally {
        hideProgress();
    }
}

let previewTimeout;
async function updatePreview() {
    // Debounce preview updates
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(async () => {
        await generatePreview();
    }, 300);
}

async function generatePreview() {
    try {
        const inputPath = document.getElementById('inputPath').value;
        const watermarkFile = document.getElementById('watermarkLogoFile').value;
        
        if (!inputPath || !watermarkFile) {
            showPreviewPlaceholder();
            return;
        }

        const settings = {
            inputPath,
            watermarkLogoFile: watermarkFile,
            images: {
                resizeSize: document.getElementById('resizeSize').value,
                outputSize: document.getElementById('outputSize').value
            },
            watermark: {
                opacity: parseFloat(document.getElementById('watermarkOpacity').value)
            }
        };

        const result = await ipcRenderer.invoke('generate-preview', settings);
        
        if (result.success) {
            showPreviewImage(result.preview, result.filename, settings);
        } else {
            showPreviewError(result.error);
        }

    } catch (error) {
        console.error('Error generating preview:', error);
        showPreviewError(error.message);
    }
}

function showPreviewPlaceholder() {
    document.getElementById('previewPlaceholder').style.display = 'block';
    document.getElementById('previewImage').style.display = 'none';
    document.getElementById('previewInfo').textContent = '';
}

function showPreviewImage(base64Data, filename, settings) {
    document.getElementById('previewPlaceholder').style.display = 'none';
    
    const previewImage = document.getElementById('previewImage');
    previewImage.src = base64Data;
    previewImage.style.display = 'block';
    
    const previewInfo = document.getElementById('previewInfo');
    previewInfo.innerHTML = `
        <strong>Sample:</strong> ${filename}<br>
        <strong>Size:</strong> ${settings.images.outputSize}×${settings.images.outputSize}px<br>
        <strong>Watermark Opacity:</strong> ${(settings.watermark.opacity * 100).toFixed(0)}%
    `;
}

function showPreviewError(error) {
    document.getElementById('previewPlaceholder').style.display = 'block';
    document.getElementById('previewImage').style.display = 'none';
    document.getElementById('previewPlaceholder').textContent = `❌ Preview Error: ${error}`;
    document.getElementById('previewInfo').textContent = '';
}