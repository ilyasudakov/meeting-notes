import { AudioChunk } from '../types/audio';

export class AudioRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private onDataAvailable: (chunk: AudioChunk) => void;

  constructor(onDataAvailable: (chunk: AudioChunk) => void) {
    this.onDataAvailable = onDataAvailable;
  }

  async startRecording(): Promise<void> {
    try {
      // Stop any existing recording
      await this.stopRecording();

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

      this.stream = stream;

      // Find supported MIME type
      const preferredTypes = [
        'audio/wav',
        'audio/webm',
        'audio/webm;codecs=pcm',
        'audio/webm;codecs=opus'
      ];
      
      const supportedMimeTypes = preferredTypes.filter(type => MediaRecorder.isTypeSupported(type));
      
      if (supportedMimeTypes.length === 0) {
        throw new Error('No supported audio MIME types found');
      }

      // Create MediaRecorder
      const options = {
        mimeType: supportedMimeTypes[0],
        audioBitsPerSecond: 256000
      };

      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.onDataAvailable({
            blob: event.data,
            timestamp: Date.now()
          });
        }
      };

      this.mediaRecorder = mediaRecorder;
      mediaRecorder.start(1000); // Capture in 1-second chunks
    } catch (error) {
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