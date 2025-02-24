import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioRecordingService } from '../services/audioRecordingService';
import { AudioProcessingService } from '../services/audioProcessingService';
import { TranscriptionService } from '../services/transcriptionService';
import { AudioChunk, LoadingState, TranscriptionResult } from '../types/audio';

export function useAudioRecorder(onTranscriptionComplete?: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState<LoadingState>({ status: 'idle', message: '' });
  const [transcribedText, setTranscribedText] = useState<string>('');

  const audioRecordingServiceRef = useRef<AudioRecordingService | null>(null);
  const audioProcessingServiceRef = useRef<AudioProcessingService | null>(null);
  const transcriptionServiceRef = useRef<TranscriptionService | null>(null);
  const audioQueueRef = useRef<AudioChunk[]>([]);
  const isProcessingRef = useRef(false);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        setLoading({ status: 'loading', message: 'Initializing services...' });
        
        audioProcessingServiceRef.current = new AudioProcessingService();
        transcriptionServiceRef.current = new TranscriptionService();
        await transcriptionServiceRef.current.initialize();
        
        audioRecordingServiceRef.current = new AudioRecordingService(
          (chunk: AudioChunk) => audioQueueRef.current.push(chunk)
        );

        setLoading({ status: 'idle', message: '' });
      } catch (error: any) {
        setLoading({ status: 'error', message: `Initialization failed: ${error.message}` });
      }
    };

    initializeServices();

    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      audioProcessingServiceRef.current?.cleanup();
    };
  }, []);

  const processAudioChunk = useCallback(async (chunk: AudioChunk): Promise<void> => {
    if (!audioProcessingServiceRef.current || !transcriptionServiceRef.current) {
      throw new Error('Services not initialized');
    }

    try {
      setLoading({ status: 'processing', message: 'Processing audio chunk...' });
      
      const audioData = await audioProcessingServiceRef.current.convertBlobToAudioData(chunk.blob);
      const result: TranscriptionResult = await transcriptionServiceRef.current.transcribe(audioData);

      if (result.error) {
        throw result.error;
      }

      if (result.text) {
        const newText = transcribedText ? transcribedText + ' ' + result.text : result.text;
        setTranscribedText(newText);
        onTranscriptionComplete?.(newText);
      }
      
      setLoading({ status: 'idle', message: '' });
    } catch (error: any) {
      setLoading({ status: 'error', message: `Error processing audio: ${error.message}` });
    }
  }, [transcribedText, onTranscriptionComplete]);

  const processNextInQueue = useCallback(async () => {
    if (!isRecording || isProcessingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    const chunk = audioQueueRef.current[0];
    if (!chunk) return;

    try {
      isProcessingRef.current = true;
      await processAudioChunk(chunk);
    } finally {
      isProcessingRef.current = false;
      audioQueueRef.current = audioQueueRef.current.slice(1);
      
      if (isRecording && audioQueueRef.current.length > 0) {
        processingTimeoutRef.current = setTimeout(processNextInQueue, 100);
      }
    }
  }, [isRecording, processAudioChunk]);

  useEffect(() => {
    if (isRecording && !isProcessingRef.current && audioQueueRef.current.length > 0) {
      processNextInQueue();
    }
  }, [isRecording, processNextInQueue]);

  const startRecording = useCallback(async () => {
    try {
      if (!audioRecordingServiceRef.current) {
        throw new Error('Recording service not initialized');
      }

      setLoading({ status: 'loading', message: 'Starting recording...' });
      await audioRecordingServiceRef.current.startRecording();
      setIsRecording(true);
      setLoading({ status: 'processing', message: 'Recording and transcribing...' });
    } catch (error: any) {
      setLoading({ status: 'error', message: error.message });
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!audioRecordingServiceRef.current) {
      return;
    }

    setIsRecording(false);
    await audioRecordingServiceRef.current.stopRecording();
    
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }

    setLoading({ status: 'idle', message: '' });
  }, []);

  return {
    isRecording,
    loading,
    transcribedText,
    startRecording,
    stopRecording
  };
} 