import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioRecordingService } from '../services/audioRecordingService';
import { AudioProcessingService } from '../services/audioProcessingService';
import { TranscriptionService } from '../services/transcriptionService';
import { AudioChunk, LoadingState } from '../types/audio';
import { logger } from '../utils/logger';

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
        logger.info('useAudioRecorder', 'Initializing audio services');
        setLoading({ status: 'loading', message: 'Initializing services...' });
        
        // Initialize all services
        audioProcessingServiceRef.current = new AudioProcessingService();
        transcriptionServiceRef.current = new TranscriptionService();
        await transcriptionServiceRef.current.initialize();
        
        // Initialize recording service with callback
        audioRecordingServiceRef.current = new AudioRecordingService((chunk) => {
          logger.debug('useAudioRecorder', `Audio chunk received: ${chunk.blob.size} bytes`);
          audioQueueRef.current.push(chunk);
          if (!isProcessingRef.current) {
            processNextChunk();
          }
        });
        
        logger.info('useAudioRecorder', 'All services initialized successfully');
        setLoading({ status: 'idle', message: '' });
      } catch (error: any) {
        logger.error('useAudioRecorder', 'Failed to initialize services:', error);
        setLoading({ status: 'error', message: `Initialization failed: ${error.message}` });
      }
    };

    initializeServices();

    return () => {
      logger.info('useAudioRecorder', 'Cleaning up services');
      audioProcessingServiceRef.current?.cleanup();
    };
  }, []);

  // Process audio chunks
  const processNextChunk = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      if (isProcessingQueue) {
        logger.debug('useAudioRecorder', 'Audio queue empty, processing complete');
        setIsProcessingQueue(false);
        setLoading({ status: 'idle', message: '' });
      }
      return;
    }
    
    isProcessingRef.current = true;
    
    try {
      const chunk = audioQueueRef.current.shift()!;
      logger.debug('useAudioRecorder', `Processing audio chunk from timestamp: ${new Date(chunk.timestamp).toISOString()}`);
      
      // Convert blob to audio data
      const audioData = await audioProcessingServiceRef.current!.convertBlobToAudioData(chunk.blob);
      
      // Transcribe audio data
      const result = await transcriptionServiceRef.current!.transcribe(audioData);
      
      // Update transcription if we got text
      if (result.text) {
        logger.info('useAudioRecorder', `New transcription text: "${result.text}"`);
        const newText = transcribedText ? `${transcribedText} ${result.text}` : result.text;
        setTranscribedText(newText);
        onTranscriptionComplete?.(newText);
      }
    } catch (error) {
      logger.error('useAudioRecorder', 'Error processing audio:', error);
    } finally {
      isProcessingRef.current = false;
      
      // Process next chunk if available
      if (audioQueueRef.current.length > 0) {
        logger.debug('useAudioRecorder', `Audio queue has ${audioQueueRef.current.length} chunks remaining`);
        processNextChunk();
      } else if (isProcessingQueue) {
        logger.debug('useAudioRecorder', 'Audio queue empty, processing complete');
        setIsProcessingQueue(false);
        setLoading({ status: 'idle', message: '' });
      }
    }
  }, [transcribedText, onTranscriptionComplete, isProcessingQueue]);

  const startRecording = useCallback(async () => {
    try {
      if (!audioRecordingServiceRef.current) {
        logger.error('useAudioRecorder', 'Recording service not initialized');
        throw new Error('Recording service not initialized');
      }

      // Clear existing data
      logger.info('useAudioRecorder', 'Starting new recording session');
      audioQueueRef.current = [];
      setTranscribedText('');
      
      setLoading({ status: 'loading', message: 'Starting transcription...' });
      await audioRecordingServiceRef.current.startRecording();
      setIsRecording(true);
      logger.info('useAudioRecorder', 'Recording started successfully');
      setLoading({ status: 'processing', message: 'Transcribing...' });
    } catch (error: any) {
      logger.error('useAudioRecorder', 'Error starting transcription:', error);
      setLoading({ status: 'error', message: error.message });
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!audioRecordingServiceRef.current) return;
    
    logger.info('useAudioRecorder', 'Stopping recording');
    setIsRecording(false);
    await audioRecordingServiceRef.current.stopRecording();
    
    // If there are chunks in the queue, set the state to indicate we're still processing
    if (audioQueueRef.current.length > 0) {
      logger.info('useAudioRecorder', `Processing ${audioQueueRef.current.length} remaining audio chunks`);
      setIsProcessingQueue(true);
      setLoading({ status: 'processing', message: 'Processing remaining audio...' });
    } else {
      logger.info('useAudioRecorder', 'Recording stopped with no pending chunks');
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