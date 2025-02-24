import { AudioChunk } from '../types/audio';

export class AudioRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private onDataAvailable: (chunk: AudioChunk) => void;
  private static CHUNK_SIZE_MS = 5000; // Increased to 5 seconds

  constructor(onDataAvailable: (chunk: AudioChunk) => void) {
    this.onDataAvailable = onDataAvailable;
    console.log('AudioRecordingService initialized with chunk size:', AudioRecordingService.CHUNK_SIZE_MS, 'ms');
  }

  async startRecording(): Promise<void> {
    try {
      console.log('Starting recording...');
      // Stop any existing recording
      await this.stopRecording();

      console.log('Requesting microphone access...');
      // Request microphone access with specific constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000
        }
      });

      console.log('Microphone access granted');
      this.stream = stream;

      // Find supported MIME type
      const preferredTypes = [
        'audio/webm;codecs=opus',  // Prioritize opus for better quality
        'audio/webm',
        'audio/wav',
        'audio/webm;codecs=pcm'
      ];
      
      const supportedMimeTypes = preferredTypes.filter(type => MediaRecorder.isTypeSupported(type));
      
      if (supportedMimeTypes.length === 0) {
        throw new Error('No supported audio MIME types found');
      }

      console.log('Using MIME type:', supportedMimeTypes[0]);

      // Create MediaRecorder with higher bitrate for better quality
      const options = {
        mimeType: supportedMimeTypes[0],
        audioBitsPerSecond: 128000
      };

      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log('Audio chunk received, size:', event.data.size, 'bytes');
          this.onDataAvailable({
            blob: event.data,
            timestamp: Date.now()
          });
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };

      this.mediaRecorder = mediaRecorder;
      mediaRecorder.start(AudioRecordingService.CHUNK_SIZE_MS); // Capture in 5-second chunks
      console.log('Recording started successfully with chunk size:', AudioRecordingService.CHUNK_SIZE_MS, 'ms');
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.cleanup();
      throw error;
    }
  }

  async stopRecording(): Promise<void> {
    console.log('Stopping recording...');
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      console.log('Recording stopped');
    }
    this.cleanup();
  }

  private cleanup(): void {
    console.log('Cleaning up audio recording resources');
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log('Audio track stopped');
      });
      this.stream = null;
    }
    this.mediaRecorder = null;
  }

  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }
} 