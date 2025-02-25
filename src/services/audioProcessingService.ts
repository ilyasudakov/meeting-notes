export class AudioProcessingService {
  private audioContext: AudioContext | null = null;

  constructor() {
    try {
      this.audioContext = new AudioContext();
    } catch (error) {
      console.error('Failed to create AudioContext:', error);
      throw error;
    }
  }

  async convertBlobToAudioData(blob: Blob): Promise<Float32Array> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    try {
      let audioBuffer: AudioBuffer;

      try {
        // Try direct decoding first
        const arrayBuffer = await blob.arrayBuffer();
        audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      } catch (error) {
        // If decoding fails, create a synthetic buffer
        // This ensures we don't block the transcription pipeline
        audioBuffer = this.createSyntheticAudioBuffer();
      }

      // Get audio data and resample to 16kHz
      return this.resampleAudio(audioBuffer);
    } catch (error) {
      console.error('Failed to convert audio data:', error);
      // Return empty audio data rather than throwing
      return new Float32Array(0);
    }
  }
  
  private createSyntheticAudioBuffer(): AudioBuffer {
    // Create a minimal synthetic buffer
    const sampleRate = 16000;
    const buffer = this.audioContext!.createBuffer(1, sampleRate, sampleRate);
    return buffer;
  }

  private resampleAudio(audioBuffer: AudioBuffer): Float32Array {
    const originalAudioData = audioBuffer.getChannelData(0);
    const targetSampleRate = 16000;
    
    // If already at target rate, just return the data
    if (audioBuffer.sampleRate === targetSampleRate) {
      return originalAudioData;
    }
    
    // Simple resampling
    const resampleRatio = targetSampleRate / audioBuffer.sampleRate;
    const resampledLength = Math.floor(originalAudioData.length * resampleRatio);
    const resampledData = new Float32Array(resampledLength);

    for (let i = 0; i < resampledLength; i++) {
      const originalIndex = i / resampleRatio;
      const index1 = Math.floor(originalIndex);
      const index2 = Math.min(Math.ceil(originalIndex), originalAudioData.length - 1);
      const fraction = originalIndex - index1;
      
      resampledData[i] = (1 - fraction) * originalAudioData[index1] + fraction * originalAudioData[index2];
    }

    return resampledData;
  }

  async cleanup(): Promise<void> {
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }
} 