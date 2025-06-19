const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 1000,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'logo.png')
  });

  mainWindow.loadFile('index.html');
  
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for file operations
ipcMain.handle('select-input-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});

ipcMain.handle('select-output-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});

ipcMain.handle('select-watermark-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp'] }
    ]
  });
  return result.filePaths[0];
});

ipcMain.handle('select-settings-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'JSON Files', extensions: ['json'] }
    ]
  });
  return result.filePaths[0];
});

ipcMain.handle('load-settings', async () => {
  try {
    const settingsPath = getSettingsPath();
    const data = fs.readFileSync(settingsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Try to load from backup if main file is corrupted
    const backupSettings = tryLoadFromBackup(settingsPath);
    if (backupSettings) {
      console.log('Loaded settings from backup file');
      return backupSettings;
    }
    return null;
  }
});

function tryLoadFromBackup(settingsPath) {
  try {
    const backupPath = settingsPath + '.backup';
    if (fs.existsSync(backupPath)) {
      const data = fs.readFileSync(backupPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('Failed to load from backup:', error.message);
  }
  return null;
}

ipcMain.handle('load-settings-from-path', async (event, settingsPath) => {
  try {
    const data = fs.readFileSync(settingsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Try to load from backup if main file is corrupted
    const backupSettings = tryLoadFromBackup(settingsPath);
    if (backupSettings) {
      console.log('Loaded settings from backup file');
      return backupSettings;
    }
    return null;
  }
});

function validateSettingsPath(settingsPath) {
  try {
    const dir = path.dirname(settingsPath);
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch (error) {
    return false;
  }
}

function createBackup(settingsPath) {
  try {
    if (fs.existsSync(settingsPath)) {
      const backupPath = settingsPath + '.backup';
      fs.copyFileSync(settingsPath, backupPath);
    }
  } catch (error) {
    console.warn('Failed to create backup:', error.message);
  }
}

ipcMain.handle('save-settings', async (event, settings, customPath) => {
  try {
    const settingsPath = customPath || getSettingsPath();
    
    // Validate path is writable
    if (!validateSettingsPath(settingsPath)) {
      throw new Error('Settings path is not writable');
    }
    
    // Create backup of existing settings
    createBackup(settingsPath);
    
    // Ensure directory exists
    const dir = path.dirname(settingsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('process-images', async (event, settings) => {
  try {
    // Import the existing image processing logic
    const imageProcessor = require('./image-processor');
    return await imageProcessor.processImages(settings);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('generate-preview', async (event, settings) => {
  try {
    const imageProcessor = require('./image-processor');
    return await imageProcessor.generatePreview(settings);
  } catch (error) {
    return { success: false, error: error.message };
  }
});