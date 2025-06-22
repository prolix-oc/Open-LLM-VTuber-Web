// Client-side audio analysis service for lip sync volume calculation
export interface AudioAnalysisResult {
  volumes: number[];
  sliceLength: number;
  duration: number;
  sampleRate: number;
  peaks: number[];
  rms: number[];
}

export interface AudioAnalysisConfig {
  sliceLength: number; // Duration of each slice in milliseconds
  smoothingFactor: number; // 0-1, higher values = more smoothing
  frequencyRange: {
    low: number; // Low frequency cutoff (Hz)
    high: number; // High frequency cutoff (Hz)
  };
  normalize: boolean; // Whether to normalize volume levels
  peakDetection: boolean; // Whether to calculate peak values
}

class AudioAnalysisService {
  private static instance: AudioAnalysisService;
  private audioContext: AudioContext | null = null;
  private defaultConfig: AudioAnalysisConfig = {
    sliceLength: 100, // 100ms slices
    smoothingFactor: 0.3,
    frequencyRange: {
      low: 80, // Human speech low frequency
      high: 255, // Human speech high frequency
    },
    normalize: true,
    peakDetection: true,
  };

  private constructor() {
    this.initializeAudioContext();
  }

  static getInstance(): AudioAnalysisService {
    if (!AudioAnalysisService.instance) {
      AudioAnalysisService.instance = new AudioAnalysisService();
    }
    return AudioAnalysisService.instance;
  }

  private initializeAudioContext(): void {
    try {
      // Use AudioContext or webkitAudioContext for broader compatibility
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      
      // Resume context if it's suspended (required by some browsers)
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
    }
  }

  /**
   * Analyzes audio from a base64 string and returns volume data for lip sync
   */
  async analyzeAudioBase64(
    audioBase64: string, 
    config: Partial<AudioAnalysisConfig> = {}
  ): Promise<AudioAnalysisResult> {
    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }

    const finalConfig = { ...this.defaultConfig, ...config };
    
    try {
      // Convert base64 to ArrayBuffer
      const audioData = this.base64ToArrayBuffer(audioBase64);
      
      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(audioData);
      
      return this.analyzeAudioBuffer(audioBuffer, finalConfig);
    } catch (error) {
      console.error('Error analyzing audio:', error);
      throw new Error(`Audio analysis failed: ${error}`);
    }
  }

  /**
   * Analyzes audio from a URL and returns volume data for lip sync
   */
  async analyzeAudioUrl(
    audioUrl: string, 
    config: Partial<AudioAnalysisConfig> = {}
  ): Promise<AudioAnalysisResult> {
    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }

    const finalConfig = { ...this.defaultConfig, ...config };
    
    try {
      // Fetch audio data
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.statusText}`);
      }
      
      const audioData = await response.arrayBuffer();
      
      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(audioData);
      
      return this.analyzeAudioBuffer(audioBuffer, finalConfig);
    } catch (error) {
      console.error('Error analyzing audio from URL:', error);
      throw new Error(`Audio analysis failed: ${error}`);
    }
  }

  /**
   * Analyzes audio from a Blob and returns volume data for lip sync
   */
  async analyzeAudioBlob(
    audioBlob: Blob, 
    config: Partial<AudioAnalysisConfig> = {}
  ): Promise<AudioAnalysisResult> {
    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }

    const finalConfig = { ...this.defaultConfig, ...config };
    
    try {
      const audioData = await audioBlob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(audioData);
      
      return this.analyzeAudioBuffer(audioBuffer, finalConfig);
    } catch (error) {
      console.error('Error analyzing audio from Blob:', error);
      throw new Error(`Audio analysis failed: ${error}`);
    }
  }

  /**
   * Core audio buffer analysis method
   */
  private analyzeAudioBuffer(
    audioBuffer: AudioBuffer, 
    config: AudioAnalysisConfig
  ): AudioAnalysisResult {
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;
    const sliceSamples = Math.floor((config.sliceLength / 1000) * sampleRate);
    const totalSamples = audioBuffer.length;
    const sliceCount = Math.ceil(totalSamples / sliceSamples);
    
    // Get audio channel data (use first channel or mix down if stereo)
    const channelData = this.getChannelData(audioBuffer);
    
    // Calculate volume levels for each slice
    const volumes: number[] = [];
    const peaks: number[] = [];
    const rms: number[] = [];
    
    for (let i = 0; i < sliceCount; i++) {
      const startSample = i * sliceSamples;
      const endSample = Math.min(startSample + sliceSamples, totalSamples);
      const sliceData = channelData.slice(startSample, endSample);
      
      // Calculate RMS (Root Mean Square) for volume
      const rmsValue = this.calculateRMS(sliceData);
      rms.push(rmsValue);
      
      // Calculate peak value
      const peakValue = this.calculatePeak(sliceData);
      peaks.push(peakValue);
      
      // Use RMS for volume with peak weighting for more dynamic lip sync
      const volume = (rmsValue * 0.7) + (peakValue * 0.3);
      volumes.push(volume);
    }
    
    // Apply smoothing
    const smoothedVolumes = this.applySmoothing(volumes, config.smoothingFactor);
    
    // Normalize if requested
    const finalVolumes = config.normalize ? 
      this.normalizeValues(smoothedVolumes) : smoothedVolumes;
    
    return {
      volumes: finalVolumes,
      sliceLength: config.sliceLength,
      duration,
      sampleRate,
      peaks: config.peakDetection ? (config.normalize ? this.normalizeValues(peaks) : peaks) : [],
      rms: config.normalize ? this.normalizeValues(rms) : rms,
    };
  }

  /**
   * Get channel data, mixing down to mono if stereo
   */
  private getChannelData(audioBuffer: AudioBuffer): Float32Array {
    if (audioBuffer.numberOfChannels === 1) {
      return audioBuffer.getChannelData(0);
    }
    
    // Mix down stereo to mono
    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = audioBuffer.getChannelData(1);
    const monoData = new Float32Array(leftChannel.length);
    
    for (let i = 0; i < leftChannel.length; i++) {
      monoData[i] = (leftChannel[i] + rightChannel[i]) / 2;
    }
    
    return monoData;
  }

  /**
   * Calculate RMS (Root Mean Square) value for a slice of audio data
   */
  private calculateRMS(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  /**
   * Calculate peak value for a slice of audio data
   */
  private calculatePeak(data: Float32Array): number {
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const absValue = Math.abs(data[i]);
      if (absValue > peak) {
        peak = absValue;
      }
    }
    return peak;
  }

  /**
   * Apply smoothing to volume data to reduce jitter
   */
  private applySmoothing(values: number[], factor: number): number[] {
    if (factor <= 0 || values.length === 0) {
      return values;
    }
    
    const smoothed = [values[0]]; // Keep first value unchanged
    
    for (let i = 1; i < values.length; i++) {
      const smoothedValue = (smoothed[i - 1] * factor) + (values[i] * (1 - factor));
      smoothed.push(smoothedValue);
    }
    
    return smoothed;
  }

  /**
   * Normalize values to 0-1 range
   */
  private normalizeValues(values: number[]): number[] {
    if (values.length === 0) return values;
    
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;
    
    if (range === 0) {
      return values.map(() => 0);
    }
    
    return values.map(value => (value - min) / range);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    // Remove data URL prefix if present
    const cleanBase64 = base64.replace(/^data:audio\/[^;]+;base64,/, '');
    
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes.buffer;
  }

  /**
   * Analyze microphone input in real-time (for future use)
   */
  async startRealtimeAnalysis(
    callback: (volume: number) => void,
    config: Partial<AudioAnalysisConfig> = {}
  ): Promise<MediaStream> {
    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }

    const finalConfig = { ...this.defaultConfig, ...config };
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = finalConfig.smoothingFactor;
      
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const analyze = () => {
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume in speech frequency range
        const startBin = Math.floor(finalConfig.frequencyRange.low / (this.audioContext!.sampleRate / 2) * dataArray.length);
        const endBin = Math.floor(finalConfig.frequencyRange.high / (this.audioContext!.sampleRate / 2) * dataArray.length);
        
        let sum = 0;
        for (let i = startBin; i < endBin; i++) {
          sum += dataArray[i];
        }
        
        const averageVolume = sum / (endBin - startBin);
        const normalizedVolume = averageVolume / 255; // Normalize to 0-1
        
        callback(normalizedVolume);
        requestAnimationFrame(analyze);
      };
      
      analyze();
      return stream;
      
    } catch (error) {
      console.error('Error starting realtime analysis:', error);
      throw error;
    }
  }

  /**
   * Get audio context state for debugging
   */
  getAudioContextState(): string | null {
    return this.audioContext?.state || null;
  }

  /**
   * Resume audio context if suspended
   */
  async resumeAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const audioAnalysisService = AudioAnalysisService.getInstance();