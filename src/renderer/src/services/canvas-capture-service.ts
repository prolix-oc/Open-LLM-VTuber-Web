// src/renderer/src/services/canvas-capture-service.ts - Memory Optimized Version

export interface CaptureOptions {
  frameRate?: number;
  width?: number;
  height?: number;
  quality?: number;
}

export class CanvasCaptureService {
  private canvas: HTMLCanvasElement | null = null;
  private mediaStream: MediaStream | null = null;
  private isCapturing = false;
  private isInitialized = false;
  private captureOptions: CaptureOptions = {
    frameRate: 30,
    quality: 0.8
  };

  // 🧠 MEMORY OPTIMIZATION: Track initialization attempts to prevent spam
  private initializationAttempted = false;

  /**
   * 🧠 MEMORY OPTIMIZATION: Check if OBS functionality should be enabled
   */
  private async shouldInitialize(): Promise<boolean> {
    try {
      // First check if OBS API is available
      if (!window.api?.obs) {
        console.log('🚫 Canvas Capture: OBS API not available');
        return false;
      }

      // Ensure OBS integration is initialized
      const initResult = await window.api.obs.ensureInitialized();
      if (!initResult.success) {
        console.warn('⚠️ Canvas Capture: OBS initialization failed:', initResult.error);
        return false;
      }

      // Check if OBS functionality is enabled in settings
      const settings = await window.api.obs.getSettings();
      console.log('🎥 Canvas Capture: OBS settings check:', { enabled: settings.enabled });
      return settings.enabled;
    } catch (error) {
      console.warn('⚠️ Canvas Capture: Could not check OBS settings:', error);
      return false;
    }
  }

  /**
   * 🧠 MEMORY OPTIMIZATION: Conditional initialization that respects OBS settings
   */
  async initialize(canvas: HTMLCanvasElement, options: Partial<CaptureOptions> = {}): Promise<boolean> {
    // Prevent multiple initialization attempts
    if (this.initializationAttempted) {
      console.log('📹 Canvas Capture: Already attempted initialization');
      return this.isInitialized;
    }

    this.initializationAttempted = true;

    const shouldInit = await this.shouldInitialize();
    
    if (!shouldInit) {
      console.log('🚫 Canvas Capture Service: OBS disabled, skipping initialization');
      return false;
    }

    try {
      this.canvas = canvas;
      this.captureOptions = { ...this.captureOptions, ...options };
      this.isInitialized = true;
      
      console.log('🎥 Canvas Capture Service initialized (OBS enabled):', {
        frameRate: this.captureOptions.frameRate,
        quality: this.captureOptions.quality,
        canvasSize: `${canvas.width}x${canvas.height}`
      });
      
      return true;
    } catch (error) {
      console.error('❌ Canvas Capture Service initialization failed:', error);
      return false;
    }
  }

  /**
   * 🧠 MEMORY OPTIMIZATION: Only start capture if properly initialized
   */
  startCapture(): MediaStream | null {
    if (!this.isInitialized) {
      console.log('🚫 Canvas capture not initialized (OBS disabled or failed), skipping');
      return null;
    }

    if (!this.canvas) {
      console.error('❌ Canvas not available for capture');
      return null;
    }

    if (this.isCapturing) {
      console.log('📹 Canvas capture already active, returning existing stream');
      return this.mediaStream;
    }

    try {
      console.log('🎬 Starting canvas capture...', {
        frameRate: this.captureOptions.frameRate,
        canvasSize: `${this.canvas.width}x${this.canvas.height}`
      });

      // Create MediaStream from canvas
      this.mediaStream = this.canvas.captureStream(this.captureOptions.frameRate);
      this.isCapturing = true;
      
      // Add event listeners for stream health monitoring
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => {
          track.addEventListener('ended', () => {
            console.log('📹 Canvas capture track ended');
            this.isCapturing = false;
          });
        });
      }
      
      console.log('✅ Canvas capture started successfully:', {
        frameRate: this.captureOptions.frameRate,
        tracks: this.mediaStream.getTracks().length,
        trackStates: this.mediaStream.getTracks().map(track => ({
          id: track.id,
          kind: track.kind,
          readyState: track.readyState,
          enabled: track.enabled
        }))
      });

      return this.mediaStream;
    } catch (error) {
      console.error('❌ Failed to start canvas capture:', error);
      this.isCapturing = false;
      return null;
    }
  }

  /**
   * 🧠 MEMORY OPTIMIZATION: Enhanced cleanup with better resource management
   */
  stopCapture(): void {
    if (!this.isCapturing && !this.mediaStream) {
      console.log('📹 Canvas capture already stopped');
      return;
    }

    console.log('🛑 Stopping canvas capture...');
    
    try {
      if (this.mediaStream) {
        // Stop all tracks properly
        this.mediaStream.getTracks().forEach(track => {
          console.log(`🛑 Stopping track: ${track.id} (${track.kind})`);
          track.stop();
        });
        
        // Remove all event listeners
        this.mediaStream.getTracks().forEach(track => {
          track.removeEventListener('ended', () => {});
        });
        
        this.mediaStream = null;
      }
      
      this.isCapturing = false;
      console.log('✅ Canvas capture stopped successfully');
    } catch (error) {
      console.error('❌ Error stopping canvas capture:', error);
      // Force cleanup even if error occurs
      this.mediaStream = null;
      this.isCapturing = false;
    }
  }

  /**
   * Get the current MediaStream
   */
  getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  /**
   * Check if currently capturing
   */
  isCurrentlyCapturing(): boolean {
    return this.isCapturing && !!this.mediaStream;
  }

  /**
   * 🧠 MEMORY OPTIMIZATION: Check if service is properly initialized
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Capture a single frame as ImageData (only if initialized)
   */
  captureFrame(): ImageData | null {
    if (!this.isInitialized || !this.canvas) {
      console.log('🚫 Canvas capture not initialized, cannot capture frame');
      return null;
    }

    try {
      const context = this.canvas.getContext('2d');
      if (!context) {
        console.error('❌ Could not get canvas 2D context');
        return null;
      }

      return context.getImageData(0, 0, this.canvas.width, this.canvas.height);
    } catch (error) {
      console.error('❌ Failed to capture frame:', error);
      return null;
    }
  }

  /**
   * Capture a single frame as Blob (PNG/JPEG) - only if initialized
   */
  async captureFrameAsBlob(type: 'image/png' | 'image/jpeg' = 'image/png'): Promise<Blob | null> {
    if (!this.isInitialized || !this.canvas) {
      console.log('🚫 Canvas capture not initialized, cannot capture frame as blob');
      return null;
    }

    try {
      return new Promise((resolve) => {
        this.canvas!.toBlob((blob) => {
          resolve(blob);
        }, type, this.captureOptions.quality);
      });
    } catch (error) {
      console.error('❌ Failed to capture frame as blob:', error);
      return null;
    }
  }

  /**
   * Update capture options (restart capture if needed)
   */
  updateOptions(options: Partial<CaptureOptions>): void {
    if (!this.isInitialized) {
      console.log('🚫 Canvas capture not initialized, cannot update options');
      return;
    }

    const oldOptions = { ...this.captureOptions };
    this.captureOptions = { ...this.captureOptions, ...options };
    
    console.log('🔧 Updating capture options:', {
      old: oldOptions,
      new: this.captureOptions
    });
    
    // If we're currently capturing and frame rate changed, restart capture
    if (this.isCapturing && oldOptions.frameRate !== this.captureOptions.frameRate) {
      console.log('🔄 Restarting capture due to frame rate change');
      this.stopCapture();
      setTimeout(() => {
        this.startCapture();
      }, 100);
    }
  }

  /**
   * Get comprehensive capture statistics
   */
  getStats(): { 
    isInitialized: boolean;
    isCapturing: boolean; 
    frameRate: number; 
    hasStream: boolean;
    trackCount: number;
    trackStates: Array<{ id: string; kind: string; readyState: string; enabled: boolean }>;
  } {
    const trackStates = this.mediaStream ? this.mediaStream.getTracks().map(track => ({
      id: track.id,
      kind: track.kind,
      readyState: track.readyState,
      enabled: track.enabled
    })) : [];

    return {
      isInitialized: this.isInitialized,
      isCapturing: this.isCapturing,
      frameRate: this.captureOptions.frameRate || 30,
      hasStream: !!this.mediaStream,
      trackCount: this.mediaStream ? this.mediaStream.getTracks().length : 0,
      trackStates
    };
  }

  /**
   * 🧠 MEMORY OPTIMIZATION: Enhanced cleanup with complete resource deallocation
   */
  cleanup(): void {
    console.log('🧹 Canvas Capture Service: Starting comprehensive cleanup...');
    
    try {
      // Stop any active capture
      this.stopCapture();
      
      // Clear canvas reference
      this.canvas = null;
      
      // Reset all state
      this.isInitialized = false;
      this.initializationAttempted = false;
      this.isCapturing = false;
      
      // Reset options to defaults
      this.captureOptions = {
        frameRate: 30,
        quality: 0.8
      };
      
      console.log('✅ Canvas Capture Service cleaned up completely');
    } catch (error) {
      console.error('❌ Error during Canvas Capture Service cleanup:', error);
      
      // Force reset state even if cleanup fails
      this.canvas = null;
      this.mediaStream = null;
      this.isInitialized = false;
      this.initializationAttempted = false;
      this.isCapturing = false;
    }
  }

  /**
   * 🧠 MEMORY OPTIMIZATION: Force reinitialization (useful when OBS settings change)
   */
  async reinitialize(canvas: HTMLCanvasElement, options: Partial<CaptureOptions> = {}): Promise<boolean> {
    console.log('🔄 Canvas Capture Service: Forcing reinitialization...');
    
    // Cleanup current state
    this.cleanup();
    
    // Attempt new initialization
    return await this.initialize(canvas, options);
  }

  /**
   * 🧠 MEMORY OPTIMIZATION: Health check method
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    obsEnabled: boolean;
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check OBS availability
    const obsEnabled = await this.shouldInitialize();
    
    if (!obsEnabled) {
      issues.push('OBS integration is disabled');
      recommendations.push('Enable OBS in settings if you need streaming features');
    }
    
    if (this.isInitialized && !this.canvas) {
      issues.push('Service initialized but canvas is null');
      recommendations.push('Reinitialize the service with a valid canvas');
    }
    
    if (this.isCapturing && !this.mediaStream) {
      issues.push('Capture state is true but no media stream exists');
      recommendations.push('Stop and restart capture');
    }
    
    if (this.mediaStream) {
      const deadTracks = this.mediaStream.getTracks().filter(track => track.readyState === 'ended');
      if (deadTracks.length > 0) {
        issues.push(`${deadTracks.length} tracks are in 'ended' state`);
        recommendations.push('Restart capture to recreate media stream');
      }
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      obsEnabled,
      recommendations
    };
  }
}

// 🧠 MEMORY OPTIMIZATION: Enhanced singleton with better lifecycle management
let canvasCaptureService: CanvasCaptureService | null = null;

export function getCanvasCaptureService(): CanvasCaptureService {
  if (!canvasCaptureService) {
    console.log('🎥 Creating Canvas Capture Service instance...');
    canvasCaptureService = new CanvasCaptureService();
  }
  return canvasCaptureService;
}

export function destroyCanvasCaptureService(): void {
  if (canvasCaptureService) {
    console.log('🗑️ Destroying Canvas Capture Service...');
    canvasCaptureService.cleanup();
    canvasCaptureService = null;
    console.log('✅ Canvas Capture Service destroyed');
  } else {
    console.log('⏸️ Canvas Capture Service was not initialized, nothing to destroy');
  }
}

// 🧠 MEMORY OPTIMIZATION: Utility function to check if OBS capture is available
export async function isOBSCaptureAvailable(): Promise<boolean> {
  try {
    if (!window.api?.obs) return false;
    
    const initResult = await window.api.obs.ensureInitialized();
    if (!initResult.success) return false;
    
    const settings = await window.api.obs.getSettings();
    return settings.enabled;
  } catch (error) {
    console.error('Failed to check OBS capture availability:', error);
    return false;
  }
}

// 🧠 MEMORY OPTIMIZATION: Listen for OBS settings changes and cleanup if disabled
if (typeof window !== 'undefined') {
  window.addEventListener('obs-settings-changed', (event: any) => {
    const { enabled } = event.detail;
    
    if (!enabled && canvasCaptureService) {
      console.log('🚫 OBS disabled, cleaning up Canvas Capture Service');
      destroyCanvasCaptureService();
    }
  });
}