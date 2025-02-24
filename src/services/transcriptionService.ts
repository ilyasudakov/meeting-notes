import { pipeline } from '@xenova/transformers';
import { TranscriptionResult } from '../types/audio';

export class TranscriptionService {
  private transcriber: any = null;

  async initialize(): Promise<void> {
    try {
      if (!this.transcriber) {
        // Initialize the pipeline
        const pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
        
        // Test the pipeline with a simple sine wave
        await this.testPipeline(pipe);
        
        this.transcriber = pipe;
      }
    } catch (error: any) {
      throw new Error(`Failed to initialize transcriber: ${error.message}`);
    }
  }

  private async testPipeline(pipe: any): Promise<void> {
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
      throw new Error('Pipeline test failed');
    }
  }

  async transcribe(audioData: Float32Array): Promise<TranscriptionResult> {
    if (!this.transcriber) {
      throw new Error('Transcriber not initialized');
    }

    try {
      // Check if audio data is valid
      const rms = Math.sqrt(audioData.reduce((sum, x) => sum + x * x, 0) / audioData.length);
      if (rms < 0.001) {
        return { text: '' }; // Audio too quiet, skip transcription
      }

      const result = await this.transcriber(audioData, {
        task: 'transcribe',
        language: 'en',
        chunk_length_s: 30,
        return_timestamps: false
      });

      const text = Array.isArray(result) 
        ? result[0]?.text || ''
        : result.text || '';

      return { text: text.trim() };
    } catch (error: any) {
      return { text: '', error: new Error(`Transcription failed: ${error.message}`) };
    }
  }
} 