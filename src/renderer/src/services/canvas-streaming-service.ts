// src/renderer/src/services/canvas-streaming-service.ts
export interface StreamingOptions {
  frameRate?: number;
  quality?: number;
  format?: 'png' | 'jpeg';
  enabled?: boolean;
}

export class CanvasStreamingService {
  private canvas: HTMLCanvasElement | null = null;
  private isStreaming = false;
  private streamingInterval: NodeJS.Timeout | null = null;
  private options: StreamingOptions = {
    frameRate: 30,
    quality: 0.8,
    format: 'jpeg',
    enabled: false
  };
  private frameCount = 0;
  private lastStatsUpdate = Date.now();

  constructor() {
    this.setupIPCHandlers();
  }

  /**
   * Initialize the streaming service with a canvas
   */
  initialize(canvas: HTMLCanvasElement, options: Partial<StreamingOptions> = {}): void {
    this.canvas = canvas;
    this.options = { ...this.options, ...options };
    console.log('🎥 Canvas Streaming Service initialized');
  }

  /**
   * Setup IPC handlers to communicate with main process
   */
  private setupIPCHandlers(): void {
    if (!window.api) return;

    // Listen for streaming start/stop commands from main process
    window.api.onOBSStartCanvasStream?.(() => {
      console.log('📡 Received start canvas stream command');
      this.startStreaming();
    });

    window.api.onOBSStopCanvasStream?.(() => {
      console.log('📡 Received stop canvas stream command');
      this.stopStreaming();
    });

    // Notify main process when canvas is ready
    if (this.canvas) {
      window.api.sendOBSCanvasReady?.();
    }
  }

  /**
   * Start streaming canvas frames
   */
  startStreaming(): void {
    if (!this.canvas) {
      console.error('❌ Cannot start streaming: canvas not initialized');
      return;
    }

    if (this.isStreaming) {
      console.log('📹 Already streaming');
      return;
    }

    console.log('🚀 Starting canvas streaming', {
      frameRate: this.options.frameRate,
      quality: this.options.quality,
      format: this.options.format
    });

    this.isStreaming = true;
    const intervalMs = 1000 / (this.options.frameRate || 30);

    this.streamingInterval = setInterval(() => {
      this.captureAndSendFrame();
    }, intervalMs);

    console.log('✅ Canvas streaming started');
  }

  /**
   * Stop streaming canvas frames
   */
  stopStreaming(): void {
    if (!this.isStreaming) {
      return;
    }

    if (this.streamingInterval) {
      clearInterval(this.streamingInterval);
      this.streamingInterval = null;
    }

    this.isStreaming = false;
    console.log('🛑 Canvas streaming stopped');
  }

  /**
   * Capture current canvas frame and send to main process
   */
  private captureAndSendFrame(): void {
    if (!this.canvas || !this.isStreaming) {
      return;
    }

    try {
      // Convert canvas to data URL
      const mimeType = this.options.format === 'png' ? 'image/png' : 'image/jpeg';
      const dataUrl = this.canvas.toDataURL(mimeType, this.options.quality);

      // Send frame data to main process
      if (window.api?.sendOBSCanvasFrame) {
        window.api.sendOBSCanvasFrame(dataUrl);
      }

      this.frameCount++;
      this.updateStats();

    } catch (error) {
      console.error('❌ Failed to capture canvas frame:', error);
    }
  }

  /**
   * Update streaming statistics
   */
  private updateStats(): void {
    const now = Date.now();
    if (now - this.lastStatsUpdate >= 5000) { // Update every 5 seconds
      const actualFps = Math.round((this.frameCount / (now - this.lastStatsUpdate)) * 1000);
      console.log(`📊 Streaming stats: ${actualFps} FPS (target: ${this.options.frameRate})`);
      
      this.frameCount = 0;
      this.lastStatsUpdate = now;
    }
  }

  /**
   * Update streaming options
   */
  updateOptions(newOptions: Partial<StreamingOptions>): void {
    const wasStreaming = this.isStreaming;
    
    if (wasStreaming) {
      this.stopStreaming();
    }

    this.options = { ...this.options, ...newOptions };
    console.log('⚙️ Streaming options updated:', this.options);

    if (wasStreaming && this.options.enabled) {
      this.startStreaming();
    }
  }

  /**
   * Manually capture and send a single frame
   */
  captureFrame(): boolean {
    if (!this.canvas) {
      console.error('❌ Cannot capture frame: canvas not initialized');
      return false;
    }

    try {
      this.captureAndSendFrame();
      return true;
    } catch (error) {
      console.error('❌ Failed to capture frame:', error);
      return false;
    }
  }

  /**
   * Get current streaming status
   */
  getStatus(): {
    isStreaming: boolean;
    hasCanvas: boolean;
    frameRate: number;
    quality: number;
    format: string;
  } {
    return {
      isStreaming: this.isStreaming,
      hasCanvas: !!this.canvas,
      frameRate: this.options.frameRate || 30,
      quality: this.options.quality || 0.8,
      format: this.options.format || 'jpeg'
    };
  }

  /**
   * Enable/disable streaming
   */
  setEnabled(enabled: boolean): void {
    this.options.enabled = enabled;
    
    if (enabled && !this.isStreaming) {
      this.startStreaming();
    } else if (!enabled && this.isStreaming) {
      this.stopStreaming();
    }
  }

  /**
   * Check if streaming is enabled
   */
  isEnabled(): boolean {
    return this.options.enabled || false;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopStreaming();
    this.canvas = null;
    console.log('🧹 Canvas Streaming Service cleaned up');
  }
}

// Singleton instance
let canvasStreamingService: CanvasStreamingService | null = null;

export function getCanvasStreamingService(): CanvasStreamingService {
  if (!canvasStreamingService) {
    canvasStreamingService = new CanvasStreamingService();
  }
  return canvasStreamingService;
}

export function destroyCanvasStreamingService(): void {
  if (canvasStreamingService) {
    canvasStreamingService.cleanup();
    canvasStreamingService = null;
  }
}