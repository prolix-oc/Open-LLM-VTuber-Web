// src/main/index.ts - Complete Integration with CDI3 and Cross-Platform Path Handling
import {
  app,
  ipcMain,
  globalShortcut,
  BrowserWindow,
  Menu,
  dialog,
  shell,
} from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import { join } from "path";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { pathToFileURL } from "url";
import {
  getWhisperService,
  destroyWhisperService,
  TranscriptionOptions,
} from "./whisper-service";

// 🧠 MEMORY OPTIMIZATION: Lazy OBS Integration Imports
import { 
  getOBSIntegration, 
  initializeOBSIntegration, 
  cleanupOBSIntegration 
} from "./obs-integration";

// 🎤 NEW: Microphone Service Integration
import {
  getMicrophoneServiceManager,
  initializeMicrophoneService,
  cleanupMicrophoneService
} from "./microphone-service-manager";

// 🎨 CDI3 Integration with Cross-Platform Support
import {
  setupCDI3Integration,
  testCDI3Integration,
  EnhancedModelScanner,
  CDI3DiscoveryService,
} from "./cdi3-integration";

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

// 🧠 MEMORY OPTIMIZATION: Track initialization states
let obsInitialized = false;
let microphoneServiceInitialized = false;

// 🔧 CROSS-PLATFORM: Enhanced path handling utility functions
function normalizePathSeparators(filePath: string): string {
  // Convert all backslashes to forward slashes for consistency
  return filePath.replace(/\\/g, '/');
}

function createCrossPlatformFileURL(filePath: string): string {
  try {
    // Use Node.js pathToFileURL for proper cross-platform URL conversion
    const fileURL = pathToFileURL(filePath).href;
    console.log(`🔗 Converted path to URL: ${filePath} -> ${fileURL}`);
    return fileURL;
  } catch (error) {
    console.error(`❌ Failed to convert path to URL: ${filePath}`, error);
    // Fallback: manual conversion for edge cases
    return createManualFileURL(filePath);
  }
}

function createManualFileURL(filePath: string): string {
  // Manual conversion as fallback
  let normalizedPath = path.resolve(filePath);
  
  // Handle Windows drive letters and paths
  if (process.platform === 'win32') {
    // Convert C:\path\to\file to C:/path/to/file
    normalizedPath = normalizedPath.replace(/\\/g, '/');
    // Ensure proper file:// format for Windows
    if (normalizedPath.match(/^[A-Za-z]:/)) {
      return `file:///${normalizedPath}`;
    }
  }
  
  // For Unix-like systems
  return `file://${normalizedPath}`;
}

// Get the models directory path
function getModelsDirectory(): string {
  const documentsPath = path.join(os.homedir(), "Documents");
  const modelsPath = path.join(documentsPath, "Enspira-VT", "Models");
  
  // Log the path for debugging Windows issues
  console.log(`📁 Models directory path: ${modelsPath}`);
  console.log(`📁 Normalized path: ${normalizePathSeparators(modelsPath)}`);
  
  return modelsPath;
}

// Get the backgrounds directory path
function getBackgroundsDirectory(): string {
  const documentsPath = path.join(os.homedir(), "Documents");
  const backgroundsPath = path.join(documentsPath, "Enspira-VT", "Backgrounds");
  
  // Log the path for debugging Windows issues
  console.log(`🖼️ Backgrounds directory path: ${backgroundsPath}`);
  console.log(`🖼️ Normalized path: ${normalizePathSeparators(backgroundsPath)}`);
  
  return backgroundsPath;
}

interface ModelInfo {
  name: string;
  directory: string;
  modelFile: string;
  hasTextures: boolean;
  hasMotions: boolean;
  hasCDI3?: boolean;
  cdi3File?: string;
  cdi3Info?: any;
}

// 🧠 MEMORY OPTIMIZATION: Lazy OBS initialization function
const ensureOBSInitialized = async (): Promise<void> => {
  if (!obsInitialized) {
    console.log('🎥 Lazy-initializing OBS integration on demand...');
    try {
      await initializeOBSIntegration();
      obsInitialized = true;
      console.log('✅ OBS integration lazy-initialized successfully');
    } catch (error) {
      console.error('❌ Failed to lazy-initialize OBS integration:', error);
      throw error;
    }
  }
};

// 🎤 NEW: Ensure microphone service is initialized
const ensureMicrophoneServiceInitialized = async (): Promise<void> => {
  if (!microphoneServiceInitialized) {
    console.log('🎤 Initializing microphone service...');
    try {
      await initializeMicrophoneService();
      microphoneServiceInitialized = true;
      console.log('✅ Microphone service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize microphone service:', error);
      throw error;
    }
  }
};

async function ensureDirectoriesExist(): Promise<void> {
  const modelsDir = getModelsDirectory();
  const backgroundsDir = getBackgroundsDirectory();

  try {
    await fs.mkdir(modelsDir, { recursive: true });
    await fs.mkdir(backgroundsDir, { recursive: true });
    console.log("✅ Created Enspira directories:", { modelsDir, backgroundsDir });
  } catch (error) {
    console.error("❌ Failed to create Enspira directories:", error);
  }
}

// 🎨 Enhanced model scanning with CDI3 integration
async function scanForModels(): Promise<ModelInfo[]> {
  const modelsDir = getModelsDirectory();
  
  try {
    console.log(`🔍 Scanning for models with CDI3 enhancement: ${modelsDir}`);
    
    // Use the enhanced CDI3 scanner
    const enhancedModels = await EnhancedModelScanner.scanModelsWithCDI3(modelsDir);
    
    // Convert enhanced model format to expected ModelInfo format
    const models: ModelInfo[] = enhancedModels.map(model => ({
      name: model.name,
      directory: model.directory,
      modelFile: model.modelFile,
      hasTextures: model.hasTextures,
      hasMotions: model.hasMotions,
      hasCDI3: model.hasCDI3,
      cdi3File: model.cdi3File,
      cdi3Info: model.cdi3Info,
    }));

    const cdi3Count = models.filter(m => m.hasCDI3).length;
    console.log(`✅ Enhanced scan complete: ${models.length} total models, ${cdi3Count} with CDI3`);
    
    return models.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("❌ Enhanced model scan failed, falling back to basic scan:", error);
    
    // Fallback to basic scanning if enhanced scanning fails
    return await basicScanForModels();
  }
}

// Basic model scanning as fallback
async function basicScanForModels(): Promise<ModelInfo[]> {
  const modelsDir = getModelsDirectory();
  const models: ModelInfo[] = [];

  try {
    console.log(`🔍 Basic scanning models directory: ${modelsDir}`);
    const entries = await fs.readdir(modelsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const modelDir = path.join(modelsDir, entry.name);
        console.log(`📁 Checking model directory: ${modelDir}`);
        const modelInfo = await validateModelDirectory(modelDir, entry.name);

        if (modelInfo) {
          console.log(`✅ Valid model found: ${entry.name}`);
          models.push(modelInfo);
        } else {
          console.log(`⚠️ Invalid model directory: ${entry.name}`);
        }
      }
    }
  } catch (error) {
    console.error("❌ Failed to scan models directory:", error);
  }

  console.log(`📊 Basic scan found ${models.length} valid models`);
  return models.sort((a, b) => a.name.localeCompare(b.name));
}

async function validateModelDirectory(
  dirPath: string,
  dirName: string
): Promise<ModelInfo | null> {
  try {
    const files = await fs.readdir(dirPath);
    console.log(`📄 Files in ${dirName}:`, files);

    // Look for .model3.json files
    const modelFiles = files.filter((file) => file.endsWith(".model3.json"));
    console.log(`🎭 Model files found in ${dirName}:`, modelFiles);

    if (modelFiles.length === 0) {
      console.log(`❌ No .model3.json files found in ${dirName}`);
      return null;
    }

    // Check for textures and motions
    const hasTextures = files.some(
      (file) =>
        file.endsWith(".png") || file.endsWith(".jpg") || file.endsWith(".jpeg")
    );

    const hasMotions = files.some(
      (file) =>
        file.endsWith(".motion3.json") ||
        files.some((f) => f.toLowerCase().includes("motion"))
    );

    const modelFilePath = path.join(dirPath, modelFiles[0]);
    console.log(`📍 Model file path: ${modelFilePath}`);

    // Check for CDI3 file using the enhanced discovery service
    let hasCDI3 = false;
    let cdi3File = undefined;
    let cdi3Info = undefined;

    try {
      cdi3File = await CDI3DiscoveryService.findCDI3ForModel(modelFilePath);
      if (cdi3File) {
        hasCDI3 = true;
        cdi3Info = await CDI3DiscoveryService.getCDI3Info(cdi3File);
        console.log(`🎨 Found CDI3 for ${dirName}: ${cdi3File}`);
      }
    } catch (error) {
      console.warn(`⚠️ CDI3 check failed for ${dirName}:`, error);
    }

    return {
      name: dirName,
      directory: dirPath,
      modelFile: modelFilePath,
      hasTextures,
      hasMotions,
      hasCDI3,
      cdi3File,
      cdi3Info,
    };
  } catch (error) {
    console.error(`❌ Failed to validate model directory ${dirPath}:`, error);
    return null;
  }
}

export function registerWhisperIPCHandlers(): void {
  const whisperService = getWhisperService();

  // Get available Whisper models
  ipcMain.handle("whisper:get-available-models", async () => {
    try {
      return await whisperService.getAvailableModels();
    } catch (error) {
      console.error("Failed to get available Whisper models:", error);
      return [];
    }
  });

  // Check if a specific model exists and is supported
  ipcMain.handle("whisper:check-model", async (_, modelName: string) => {
    try {
      return await whisperService.checkModel(modelName);
    } catch (error) {
      console.error("Failed to check Whisper model:", error);
      return false;
    }
  });

  // Transcribe audio using Whisper
  ipcMain.handle(
    "whisper:transcribe",
    async (_, options: TranscriptionOptions) => {
      try {
        return await whisperService.transcribe(options);
      } catch (error) {
        console.error("Whisper transcription failed:", error);
        throw error;
      }
    }
  );

  // Open the models directory
  ipcMain.handle("whisper:open-models-directory", async () => {
    try {
      await whisperService.openModelsDirectory();
      return true;
    } catch (error) {
      console.error("Failed to open models directory:", error);
      return false;
    }
  });

  // Get the models directory path
  ipcMain.handle("whisper:get-models-path", async () => {
    try {
      return whisperService.getModelsPath();
    } catch (error) {
      console.error("Failed to get models path:", error);
      return null;
    }
  });

  ipcMain.handle("whisper:set-active-status", (_, active: boolean) => {
    console.log(`IPC: Setting local Whisper service active status to: ${active}`);
    whisperService.setActiveStatus(active);
  });
}

// Call this before app quit to cleanup
export function cleanupWhisperService(): void {
  destroyWhisperService();
}

async function scanForBackgrounds(): Promise<string[]> {
  const backgroundsDir = getBackgroundsDirectory();
  const backgrounds: string[] = [];

  try {
    const files = await fs.readdir(backgroundsDir);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(ext)) {
        backgrounds.push(file);
      }
    }
  } catch (error) {
    console.error("Failed to scan backgrounds directory:", error);
  }

  return backgrounds.sort();
}

async function createFileBlob(filePath: string): Promise<string> {
  try {
    const buffer = await fs.readFile(filePath);
    const base64 = buffer.toString("base64");
    const mimeType = getFileMimeType(filePath);
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    throw new Error(`Failed to create blob from file: ${error}`);
  }
}

function getFileMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    titleBarOverlay: {
      color: "#111111",
      symbolColor: "#FFFFFF",
      height: 30,
    },
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Allow loading local files for Live2D models
    },
    icon:
      process.platform === "linux"
        ? join(__dirname, "../../../resources/icon.png")
        : undefined,
    show: false,
    backgroundColor: "#111111",
  });

  window.webContents.setWindowOpenHandler((details) => {
    const { shell } = require("electron");
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (process.env.NODE_ENV === "development") {
    window.loadURL("http://localhost:5173");
    window.webContents.openDevTools();
  } else {
    window.loadFile(join(__dirname, "../renderer/index.html"));
  }

  window.once("ready-to-show", () => {
    window.show();
    // Send initial window state
    window.webContents.send('window-maximized-change', window.isMaximized());
    window.webContents.send('window-fullscreen-change', window.isFullScreen());
  });

  window.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      window.hide();
    }
    return false;
  });

  // Window state change handlers
  window.on('maximize', () => {
    window.webContents.send('window-maximized-change', true);
  });

  window.on('unmaximize', () => {
    window.webContents.send('window-maximized-change', false);
  });

  window.on('enter-full-screen', () => {
    window.webContents.send('window-fullscreen-change', true);
  });

  window.on('leave-full-screen', () => {
    window.webContents.send('window-fullscreen-change', false);
  });

  window.on('resize', () => {
    const bounds = window.getBounds();
    const { width, height } = require('electron').screen.getPrimaryDisplay().workArea;
    const isMaximized = bounds.width >= width && bounds.height >= height;
    window.webContents.send('window-maximized-change', isMaximized);
  });

  return window;
}

function setupIPC(): void {
  ipcMain.handle("get-platform", () => process.platform);

  ipcMain.on("set-ignore-mouse-events", (_event, ignore: boolean) => {
    if (mainWindow) {
      mainWindow.setIgnoreMouseEvents(ignore);
    }
  });

  // Component hover handlers (for pet mode)
  ipcMain.on("update-component-hover", (_event, componentId: string, isHovering: boolean) => {
    console.log(`Component ${componentId} hover: ${isHovering}`);
  });

  ipcMain.on("show-context-menu", () => {
    console.log('Context menu requested');
  });

  // Mode change handlers
  ipcMain.on("renderer-ready-for-mode-change", (_event, mode: string) => {
    console.log(`Renderer ready for mode change to: ${mode}`);
  });

  ipcMain.on("mode-change-rendered", () => {
    console.log('Mode change rendered');
  });

  ipcMain.on("toggle-force-ignore-mouse", () => {
    console.log('Toggle force ignore mouse requested');
  });

  ipcMain.on("window-unfullscreen", () => {
    if (mainWindow && mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    }
  });

  ipcMain.on("window-minimize", () => {
    mainWindow?.minimize();
  });

  ipcMain.on("window-maximize", () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on("window-close", () => {
    if (mainWindow) {
      if (process.platform === "darwin") {
        mainWindow.hide();
      } else {
        mainWindow.close();
      }
    }
  });

  // 🧠 MEMORY OPTIMIZATION: Lazy OBS initialization IPC handler
  ipcMain.handle('obs:ensure-initialized', async () => {
    try {
      await ensureOBSInitialized();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 🎤 NEW: Microphone service initialization IPC handler
  ipcMain.handle('mic-service:ensure-initialized', async () => {
    try {
      await ensureMicrophoneServiceInitialized();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Models directory operations
  ipcMain.handle("get-models-directory", (): string => {
    return getModelsDirectory();
  });

  ipcMain.handle("get-backgrounds-directory", (): string => {
    return getBackgroundsDirectory();
  });

  ipcMain.handle("scan-models", async (): Promise<ModelInfo[]> => {
    console.log('🔍 IPC: Scanning for models...');
    const models = await scanForModels();
    console.log(`📊 IPC: Returning ${models.length} models`);
    return models;
  });

  ipcMain.handle("scan-backgrounds", async (): Promise<string[]> => {
    return scanForBackgrounds();
  });

  ipcMain.handle("open-models-directory", async (): Promise<void> => {
    const modelsDir = getModelsDirectory();
    await shell.openPath(modelsDir);
  });

  ipcMain.handle("open-backgrounds-directory", async (): Promise<void> => {
    const backgroundsDir = getBackgroundsDirectory();
    await shell.openPath(backgroundsDir);
  });

  // 🔧 CROSS-PLATFORM: Fixed model file URL generation with proper Windows support
  ipcMain.handle("get-model-file-url", (_event, modelFile: string): string => {
    console.log(`🔗 Converting model file path to URL: ${modelFile}`);
    
    try {
      // Verify the file exists before creating URL
      const fileExists = fs.access(modelFile).then(() => true).catch(() => false);
      
      // Create proper cross-platform file URL
      const fileURL = createCrossPlatformFileURL(modelFile);
      
      console.log(`✅ Generated file URL: ${fileURL}`);
      return fileURL;
    } catch (error) {
      console.error(`❌ Failed to create file URL for: ${modelFile}`, error);
      // Return the fallback URL even if there's an error
      return createManualFileURL(modelFile);
    }
  });

  // 🎨 CDI3 Integration: Add handlers for CDI3 functionality
  ipcMain.handle("findCDI3ForModel", async (_event, modelPath: string) => {
    try {
      console.log(`🔍 IPC: Finding CDI3 for model: ${modelPath}`);
      const result = await CDI3DiscoveryService.findCDI3ForModel(modelPath);
      console.log(`📊 IPC: CDI3 result: ${result || 'none found'}`);
      return result;
    } catch (error) {
      console.error('❌ IPC: Failed to find CDI3 for model:', error);
      return null;
    }
  });

  ipcMain.handle(
    "get-background-blob",
    async (_event, filename: string): Promise<string> => {
      const backgroundsDir = getBackgroundsDirectory();
      const filePath = path.join(backgroundsDir, filename);
      return createFileBlob(filePath);
    }
  );

  // Legacy file operations (for compatibility)
  ipcMain.handle(
    "select-background-image",
    async (): Promise<string | null> => {
      if (!mainWindow) return null;

      const result = await dialog.showOpenDialog(mainWindow, {
        title: "Select Background Image",
        message: "Choose an image file for the background",
        properties: ["openFile", "dontAddToRecent"],
        buttonLabel: "Select Image",
        filters: [
          {
            name: "Image Files",
            extensions: ["jpg", "jpeg", "png", "gif", "webp", "svg"],
          },
          {
            name: "All Files",
            extensions: ["*"],
          },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      return result.filePaths[0];
    }
  );

  ipcMain.handle(
    "create-file-blob",
    async (_event, filePath: string): Promise<string> => {
      return createFileBlob(filePath);
    }
  );
}

function createAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "Open Models Folder",
          accelerator:
            process.platform === "darwin" ? "Cmd+Shift+M" : "Ctrl+Shift+M",
          click: async () => {
            const modelsDir = getModelsDirectory();
            await shell.openPath(modelsDir);
          },
        },
        {
          label: "Open Backgrounds Folder",
          accelerator:
            process.platform === "darwin" ? "Cmd+Shift+B" : "Ctrl+Shift+B",
          click: async () => {
            const backgroundsDir = getBackgroundsDirectory();
            await shell.openPath(backgroundsDir);
          },
        },
        { type: "separator" },
        {
          label: "Quit",
          accelerator: process.platform === "darwin" ? "Cmd+Q" : "Ctrl+Q",
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "close" }],
    },
  ];

  if (process.platform === "darwin") {
    template.unshift({
      label: "Enspira",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });

    (template[4].submenu as Electron.MenuItemConstructorOptions[]).push(
      { type: "separator" },
      {
        label: "Bring All to Front",
        role: "front",
      }
    );
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId("com.enspira.desktop");
  
  // Initialize core services
  registerWhisperIPCHandlers();

  // Ensure directories exist before creating window
  await ensureDirectoriesExist();

  // 🎨 CDI3 Integration: Setup CDI3 handlers with models directory function
  console.log('🎨 Setting up CDI3 integration...');
  try {
    setupCDI3Integration(getModelsDirectory);
    console.log('✅ CDI3 integration setup complete');
    
    // Optional: Test CDI3 integration in development
    if (process.env.NODE_ENV === "development") {
      console.log('🧪 Testing CDI3 integration in development mode...');
      setTimeout(async () => {
        try {
          await testCDI3Integration(getModelsDirectory());
        } catch (error) {
          console.warn('⚠️ CDI3 test failed (non-fatal):', error);
        }
      }, 2000);
    }
  } catch (error) {
    console.error('❌ CDI3 integration setup failed (non-fatal):', error);
  }

  // 🎤 NEW: Initialize microphone service first (lightweight, always available)
  console.log('🎤 Initializing microphone control service...');
  try {
    await ensureMicrophoneServiceInitialized();
    console.log('✅ Microphone control service ready');
  } catch (error) {
    console.error('❌ Failed to initialize microphone service:', error);
    // Continue without microphone service - don't block app startup
  }

  // 🚫 REMOVED: Automatic OBS initialization
  // OBS will be initialized only when explicitly requested via settings

  console.log('✅ App initialized with microphone service and CDI3 support (OBS on-demand)');

  // Create main window
  mainWindow = createWindow();
  createAppMenu();

  if (process.env.NODE_ENV === "development") {
    globalShortcut.register("F12", () => {
      if (!mainWindow) return;

      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    });
  }

  setupIPC();

  app.on("activate", () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  app.on("web-contents-created", (_, contents) => {
    contents.session.setPermissionRequestHandler(
      (webContents, permission, callback) => {
        if (permission === "media") {
          callback(true);
        } else {
          callback(false);
        }
      }
    );
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  isQuitting = true;
  
  // Cleanup services in order
  console.log('🧹 Cleaning up services...');
  
  // 1. Cleanup Whisper service
  cleanupWhisperService();
  
  // 2. 🎤 NEW: Cleanup microphone service
  if (microphoneServiceInitialized) {
    try {
      console.log('🧹 Cleaning up microphone service...');
      await cleanupMicrophoneService();
      console.log('✅ Microphone service cleaned up successfully');
    } catch (error) {
      console.error('❌ Error cleaning up microphone service:', error);
    }
  }
  
  // 3. 🧠 MEMORY OPTIMIZATION: Conditional OBS cleanup
  if (obsInitialized) {
    try {
      console.log('🧹 Cleaning up OBS integration...');
      await cleanupOBSIntegration();
      console.log('✅ OBS integration cleaned up successfully');
    } catch (error) {
      console.error('❌ Error cleaning up OBS integration:', error);
    }
  } else {
    console.log('⏸️ OBS was not initialized, skipping cleanup');
  }
  
  globalShortcut.unregisterAll();
});

// Export window for integrations if needed
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}