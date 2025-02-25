import { AudioChunk } from '../types/audio';

export class AudioRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private onDataAvailable: (chunk: AudioChunk) => void;
  private static CHUNK_SIZE_MS = 3000; // 3 seconds chunks

  constructor(onDataAvailable: (chunk: AudioChunk) => void) {
    this.onDataAvailable = onDataAvailable;
  }

  async startRecording(): Promise<void> {
    try {
      // Stop any existing recording
      await this.stopRecording();

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
      
      // Create MediaRecorder with default settings
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.onDataAvailable({
            blob: event.data,
            timestamp: Date.now()
          });
        }
      };

      this.mediaRecorder = mediaRecorder;
      mediaRecorder.start(AudioRecordingService.CHUNK_SIZE_MS);
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.cleanup();
      throw error;
    }
  }

  async stopRecording(): Promise<void> {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
  }

  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }
} 