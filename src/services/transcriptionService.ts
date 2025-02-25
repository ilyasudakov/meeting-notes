import { pipeline } from '@xenova/transformers';
import { TranscriptionResult } from '../types/audio';

export class TranscriptionService {
  private transcriber: any = null;

  async initialize(): Promise<void> {
    if (this.transcriber) {
      return;
    }

    try {
      console.log('Initializing transcription service...');
      this.transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
      console.log('Transcription service initialized');
    } catch (error) {
      console.error('Failed to initialize transcriber:', error);
      throw error;
    }
  }

  async transcribe(audioData: Float32Array): Promise<TranscriptionResult> {
    if (!this.transcriber) {
      throw new Error('Transcriber not initialized');
    }

    try {
      // Skip empty audio or audio that's too quiet
      if (!audioData || audioData.length === 0) {
        return { text: '' };
      }
      
      const rms = Math.sqrt(audioData.reduce((sum, x) => sum + x * x, 0) / audioData.length);
      if (rms < 0.001) {
        return { text: '' }; // Audio too quiet
      }

      const result = await this.transcriber(audioData, {
        task: 'transcribe',
        language: 'en'
      });
      
      const text = Array.isArray(result) 
        ? result[0]?.text || ''
        : result.text || '';

      return { text: text.trim() };
    } catch (error: any) {
      console.error('Transcription failed:', error);
      return { text: '', error };
    }
  }
} 