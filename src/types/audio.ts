export interface AudioChunk {
  blob: Blob;
  timestamp: number;
}

export interface LoadingState {
  status: 'idle' | 'loading' | 'processing' | 'error';
  message: string;
}

export interface AudioRecorderProps {
  onTranscriptionComplete?: (text: string) => void;
}

export interface TranscriptionResult {
  text: string;
  error?: Error;
} 