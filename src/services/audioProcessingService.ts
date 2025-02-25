import { logger } from '../utils/logger';

export class AudioProcessingService {
  private audioContext: AudioContext | null = null;

  constructor() {
    try {
      this.audioContext = new AudioContext();
      logger.info('AudioProcessingService', 'Service initialized with sample rate:', this.audioContext.sampleRate);
    } catch (error) {
      logger.error('AudioProcessingService', 'Failed to create AudioContext:', error);
      throw error;
    }
  }

  async convertBlobToAudioData(blob: Blob): Promise<Float32Array> {
    if (!this.audioContext) {
      logger.error('AudioProcessingService', 'AudioContext not initialized');
      throw new Error('AudioContext not initialized');
    }

    try {
      logger.debug('AudioProcessingService', `Processing audio blob: ${blob.size} bytes, type: ${blob.type}`);
      
      // Check if the blob is valid
      if (blob.size === 0) {
        logger.warn('AudioProcessingService', 'Empty audio blob received, using synthetic buffer');
        return this.createSyntheticAudioBuffer().getChannelData(0);
      }
      
      let audioBuffer: AudioBuffer;

      try {
        // Convert blob to array buffer
        const arrayBuffer = await blob.arrayBuffer();
        logger.debug('AudioProcessingService', `Decoding audio data: ${arrayBuffer.byteLength} bytes`);
        
        // Try to decode the audio data
        try {
          audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
          logger.debug('AudioProcessingService', `Audio decoded successfully: ${audioBuffer.duration}s, ${audioBuffer.numberOfChannels} channels`);
        } catch (decodeError) {
          // If standard decoding fails, try with a new AudioContext
          // This can help in some browsers where the AudioContext state might be affecting decoding
          logger.warn('AudioProcessingService', 'Standard decoding failed, trying with new AudioContext:', decodeError);
          
          const tempContext = new AudioContext();
          try {
            audioBuffer = await tempContext.decodeAudioData(arrayBuffer);
            logger.debug('AudioProcessingService', 'Decoding succeeded with new AudioContext');
            await tempContext.close();
          } catch (secondError) {
            logger.warn('AudioProcessingService', 'Secondary decoding also failed:', secondError);
            await tempContext.close();
            throw secondError;
          }
        }
      } catch (error) {
        // If all decoding attempts fail, create a synthetic buffer
        logger.warn('AudioProcessingService', 'Audio decoding failed, using synthetic buffer:', error);
        audioBuffer = this.createSyntheticAudioBuffer();
      }

      // Get audio data and resample to 16kHz
      const resampledData = this.resampleAudio(audioBuffer);
      logger.debug('AudioProcessingService', `Audio resampled: ${resampledData.length} samples`);
      return resampledData;
    } catch (error) {
      logger.error('AudioProcessingService', 'Failed to convert audio data:', error);
      // Return empty audio data rather than throwing
      return new Float32Array(0);
    }
  }
  
  private createSyntheticAudioBuffer(): AudioBuffer {
    // Create a minimal synthetic buffer
    const sampleRate = 16000;
    logger.debug('AudioProcessingService', `Creating synthetic buffer with sample rate: ${sampleRate}Hz`);
    const buffer = this.audioContext!.createBuffer(1, sampleRate, sampleRate);
    return buffer;
  }

  private resampleAudio(audioBuffer: AudioBuffer): Float32Array {
    const originalAudioData = audioBuffer.getChannelData(0);
    const targetSampleRate = 16000;
    
    // If already at target rate, just return the data
    if (audioBuffer.sampleRate === targetSampleRate) {
      logger.debug('AudioProcessingService', 'Audio already at target sample rate, skipping resampling');
      return originalAudioData;
    }
    
    logger.debug('AudioProcessingService', `Resampling audio from ${audioBuffer.sampleRate}Hz to ${targetSampleRate}Hz`);
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
      logger.info('AudioProcessingService', 'Cleaning up AudioContext');
      await this.audioContext.close();
      this.audioContext = null;
    }
  }
} 