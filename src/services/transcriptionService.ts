import { pipeline } from '@xenova/transformers';
import { TranscriptionResult } from '../types/audio';

export class TranscriptionService {
  private transcriber: any = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.transcriber) {
      console.log('Transcriber already initialized');
      return;
    }

    if (this.isInitializing) {
      console.log('Transcriber initialization already in progress, waiting...');
      if (this.initPromise) {
        return this.initPromise;
      }
    }

    this.isInitializing = true;
    this.initPromise = this._initialize();
    return this.initPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      console.log('Initializing transcription service...');
      // Initialize the pipeline
      const pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
      console.log('Pipeline created successfully');
      
      // Test the pipeline with a simple sine wave
      await this.testPipeline(pipe);
      console.log('Pipeline test completed successfully');
      
      this.transcriber = pipe;
      this.isInitializing = false;
    } catch (error: any) {
      console.error('Transcription service initialization failed:', error);
      this.isInitializing = false;
      throw new Error(`Failed to initialize transcriber: ${error.message}`);
    }
  }

  private async testPipeline(pipe: any): Promise<void> {
    console.log('Testing transcription pipeline...');
    // Create a test audio sample (1-second sine wave)
    const sampleRate = 16000;
    const duration = 1;
    const frequency = 440;
    const testData = new Float32Array(sampleRate * duration);
    
    for (let i = 0; i < testData.length; i++) {
      testData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }

    try {
      await pipe(testData, {
        task: 'transcribe',
        language: 'en',
      });
    } catch (error) {
      console.error('Pipeline test failed:', error);
      throw new Error('Pipeline test failed');
    }
  }

  async transcribe(audioData: Float32Array): Promise<TranscriptionResult> {
    if (!this.transcriber) {
      console.error('Transcriber not initialized');
      throw new Error('Transcriber not initialized');
    }

    try {
      // Check if audio data is valid
      const rms = Math.sqrt(audioData.reduce((sum, x) => sum + x * x, 0) / audioData.length);
      console.log('Audio RMS level:', rms);
      
      if (rms < 0.001) {
        console.log('Audio too quiet, skipping transcription');
        return { text: '' }; // Audio too quiet, skip transcription
      }

      console.log('Starting transcription of audio with length:', audioData.length);
      const result = await this.transcriber(audioData, {
        task: 'transcribe',
        language: 'en',
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false
      });

      const text = Array.isArray(result) 
        ? result[0]?.text || ''
        : result.text || '';

      console.log('Transcription completed:', text);
      return { text: text.trim() };
    } catch (error: any) {
      console.error('Transcription failed:', error);
      return { text: '', error: new Error(`Transcription failed: ${error.message}`) };
    }
  }
} 