import { pipeline } from '@xenova/transformers';
import { TranscriptionResult } from '../types/audio';
import { logger } from '../utils/logger';

export class TranscriptionService {
  private transcriber: any = null;

  async initialize(): Promise<void> {
    if (this.transcriber) {
      logger.debug('TranscriptionService', 'Transcriber already initialized, skipping');
      return;
    }

    try {
      logger.info('TranscriptionService', 'Initializing transcription service with Whisper model');
      this.transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
      logger.info('TranscriptionService', 'Transcription service initialized successfully');
    } catch (error) {
      logger.error('TranscriptionService', 'Failed to initialize transcriber:', error);
      throw error;
    }
  }

  async transcribe(audioData: Float32Array): Promise<TranscriptionResult> {
    if (!this.transcriber) {
      logger.error('TranscriptionService', 'Transcriber not initialized');
      throw new Error('Transcriber not initialized');
    }

    try {
      // Skip empty audio or audio that's too quiet
      if (!audioData || audioData.length === 0) {
        logger.debug('TranscriptionService', 'Empty audio data received, skipping transcription');
        return { text: '' };
      }
      
      const rms = Math.sqrt(audioData.reduce((sum, x) => sum + x * x, 0) / audioData.length);
      logger.debug('TranscriptionService', `Audio RMS level: ${rms.toFixed(6)}`);
      
      if (rms < 0.001) {
        logger.debug('TranscriptionService', 'Audio too quiet, skipping transcription');
        return { text: '' }; // Audio too quiet
      }

      logger.debug('TranscriptionService', `Transcribing audio data: ${audioData.length} samples`);
      const result = await this.transcriber(audioData, {
        task: 'transcribe',
        language: 'en'
      });
      
      const text = Array.isArray(result) 
        ? result[0]?.text || ''
        : result.text || '';

      logger.debug('TranscriptionService', `Transcription result: "${text}"`);
      return { text: text.trim() };
    } catch (error: any) {
      logger.error('TranscriptionService', 'Transcription failed:', error);
      return { text: '', error };
    }
  }
} 