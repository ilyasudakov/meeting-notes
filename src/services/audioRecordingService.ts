import { AudioChunk } from '../types/audio';
import { logger } from '../utils/logger';

export class AudioRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private onDataAvailable: (chunk: AudioChunk) => void;
  private static CHUNK_SIZE_MS = 3000; // 3 seconds chunks

  constructor(onDataAvailable: (chunk: AudioChunk) => void) {
    this.onDataAvailable = onDataAvailable;
    logger.info('AudioRecordingService', 'Service initialized');
  }

  async startRecording(): Promise<void> {
    try {
      // Stop any existing recording
      await this.stopRecording();

      logger.info('AudioRecordingService', 'Requesting microphone access');
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000
        }
      });

      this.stream = stream;
      logger.info('AudioRecordingService', 'Microphone access granted');
      
      // Select the most compatible MIME type
      const mimeType = this.getSupportedMimeType();
      logger.info('AudioRecordingService', `Using MIME type: ${mimeType}`);
      
      // Create MediaRecorder with selected MIME type
      const options: MediaRecorderOptions = {
        mimeType: mimeType
      };
      
      const mediaRecorder = new MediaRecorder(stream, options);
      logger.debug('AudioRecordingService', `MediaRecorder created with MIME type: ${mediaRecorder.mimeType}`);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          logger.debug('AudioRecordingService', `Audio chunk received: ${event.data.size} bytes`);
          this.onDataAvailable({
            blob: event.data,
            timestamp: Date.now()
          });
        }
      };

      this.mediaRecorder = mediaRecorder;
      mediaRecorder.start(AudioRecordingService.CHUNK_SIZE_MS);
      logger.info('AudioRecordingService', `Recording started with chunk size: ${AudioRecordingService.CHUNK_SIZE_MS}ms`);
    } catch (error) {
      logger.error('AudioRecordingService', 'Failed to start recording:', error);
      this.cleanup();
      throw error;
    }
  }

  // Helper method to find a supported MIME type
  private getSupportedMimeType(): string {
    // List of MIME types in order of preference
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
      'audio/wav',
      ''  // Empty string means use browser default
    ];
    
    for (const type of mimeTypes) {
      if (type === '' || MediaRecorder.isTypeSupported(type)) {
        logger.debug('AudioRecordingService', `Found supported MIME type: ${type || 'browser default'}`);
        return type;
      }
    }
    
    // If no supported type is found, return empty string to use browser default
    logger.warn('AudioRecordingService', 'No explicitly supported MIME types found, using browser default');
    return '';
  }

  async stopRecording(): Promise<void> {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      logger.info('AudioRecordingService', 'Stopping recording');
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.stream) {
      logger.debug('AudioRecordingService', 'Cleaning up media tracks');
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
  }

  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }
} 