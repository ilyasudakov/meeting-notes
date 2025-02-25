import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioRecordingService } from '../services/audioRecordingService';
import { AudioProcessingService } from '../services/audioProcessingService';
import { TranscriptionService } from '../services/transcriptionService';
import { AudioChunk, LoadingState } from '../types/audio';

export function useAudioRecorder(onTranscriptionComplete?: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState<LoadingState>({ status: 'idle', message: '' });
  const [transcribedText, setTranscribedText] = useState<string>('');
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  const audioRecordingServiceRef = useRef<AudioRecordingService | null>(null);
  const audioProcessingServiceRef = useRef<AudioProcessingService | null>(null);
  const transcriptionServiceRef = useRef<TranscriptionService | null>(null);
  const audioQueueRef = useRef<AudioChunk[]>([]);
  const isProcessingRef = useRef(false);

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        setLoading({ status: 'loading', message: 'Initializing services...' });
        
        // Initialize all services
        audioProcessingServiceRef.current = new AudioProcessingService();
        transcriptionServiceRef.current = new TranscriptionService();
        await transcriptionServiceRef.current.initialize();
        
        // Initialize recording service with callback
        audioRecordingServiceRef.current = new AudioRecordingService((chunk) => {
          audioQueueRef.current.push(chunk);
          if (!isProcessingRef.current) {
            processNextChunk();
          }
        });
        
        setLoading({ status: 'idle', message: '' });
      } catch (error: any) {
        console.error('Failed to initialize services:', error);
        setLoading({ status: 'error', message: `Initialization failed: ${error.message}` });
      }
    };

    initializeServices();

    return () => {
      audioProcessingServiceRef.current?.cleanup();
    };
  }, []);

  // Process audio chunks
  const processNextChunk = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      if (isProcessingQueue) {
        setIsProcessingQueue(false);
        setLoading({ status: 'idle', message: '' });
      }
      return;
    }
    
    isProcessingRef.current = true;
    
    try {
      const chunk = audioQueueRef.current.shift()!;
      
      // Convert blob to audio data
      const audioData = await audioProcessingServiceRef.current!.convertBlobToAudioData(chunk.blob);
      
      // Transcribe audio data
      const result = await transcriptionServiceRef.current!.transcribe(audioData);
      
      // Update transcription if we got text
      if (result.text) {
        const newText = transcribedText ? `${transcribedText} ${result.text}` : result.text;
        setTranscribedText(newText);
        onTranscriptionComplete?.(newText);
      }
    } catch (error) {
      console.error('Error processing audio:', error);
    } finally {
      isProcessingRef.current = false;
      
      // Process next chunk if available
      if (audioQueueRef.current.length > 0) {
        processNextChunk();
      } else if (isProcessingQueue) {
        setIsProcessingQueue(false);
        setLoading({ status: 'idle', message: '' });
      }
    }
  }, [transcribedText, onTranscriptionComplete, isProcessingQueue]);

  const startRecording = useCallback(async () => {
    try {
      if (!audioRecordingServiceRef.current) {
        throw new Error('Recording service not initialized');
      }

      // Clear existing data
      audioQueueRef.current = [];
      setTranscribedText('');
      
      setLoading({ status: 'loading', message: 'Starting transcription...' });
      await audioRecordingServiceRef.current.startRecording();
      setIsRecording(true);
      setLoading({ status: 'processing', message: 'Transcribing...' });
    } catch (error: any) {
      console.error('Error starting transcription:', error);
      setLoading({ status: 'error', message: error.message });
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!audioRecordingServiceRef.current) return;
    
    setIsRecording(false);
    await audioRecordingServiceRef.current.stopRecording();
    
    // If there are chunks in the queue, set the state to indicate we're still processing
    if (audioQueueRef.current.length > 0) {
      setIsProcessingQueue(true);
      setLoading({ status: 'processing', message: 'Processing remaining audio...' });
    } else {
      setLoading({ status: 'idle', message: '' });
    }
  }, []);

  return {
    isRecording,
    loading,
    transcribedText,
    isProcessingQueue,
    startRecording,
    stopRecording
  };
} 