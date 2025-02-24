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
        console.log('Initializing audio services...');
        setLoading({ status: 'loading', message: 'Initializing services...' });
        
        audioProcessingServiceRef.current = new AudioProcessingService();
        transcriptionServiceRef.current = new TranscriptionService();
        console.log('Created service instances, initializing transcription...');
        await transcriptionServiceRef.current.initialize();
        console.log('Transcription service initialized successfully');
        
        audioRecordingServiceRef.current = new AudioRecordingService(
          (chunk: AudioChunk) => {
            console.log('Received audio chunk, size:', chunk.blob.size, 'bytes');
            // Process each chunk immediately
            audioQueueRef.current.push(chunk);
            
            // Trigger processing if not already processing
            if (!isProcessingRef.current) {
              processNextInQueue();
            }
          }
        );

        setLoading({ status: 'idle', message: '' });
        console.log('All services initialized successfully');
      } catch (error: any) {
        console.error('Service initialization failed:', error);
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
      console.error('Services not initialized in processAudioChunk');
      throw new Error('Services not initialized');
    }

    try {
      console.log('Processing audio chunk of size:', chunk.blob.size, 'bytes');
      setLoading({ status: 'processing', message: 'Processing audio chunk...' });
      
      const audioData = await audioProcessingServiceRef.current.convertBlobToAudioData(chunk.blob);
      console.log('Audio data converted, starting transcription...');
      const result: TranscriptionResult = await transcriptionServiceRef.current.transcribe(audioData);

      if (result.error) {
        console.error('Transcription error:', result.error);
        throw result.error;
      }

      if (result.text && result.text.trim()) {
        console.log('Transcription successful:', result.text);
        const newText = transcribedText ? transcribedText + ' ' + result.text : result.text;
        setTranscribedText(newText);
        onTranscriptionComplete?.(newText);
      } else {
        console.log('No text transcribed from this chunk');
      }
      
      setLoading({ status: 'idle', message: '' });
    } catch (error: any) {
      console.error('Error in processAudioChunk:', error);
      setLoading({ status: 'error', message: `Error processing audio: ${error.message}` });
    }
  }, [transcribedText, onTranscriptionComplete]);

  const processNextInQueue = useCallback(async () => {
    if (isProcessingRef.current || audioQueueRef.current.length === 0) {
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
      
      // Continue processing if there are more chunks
      if (audioQueueRef.current.length > 0) {
        processingTimeoutRef.current = setTimeout(processNextInQueue, 100);
      }
    }
  }, [processAudioChunk]);

  // Monitor queue for new items
  useEffect(() => {
    if (!isProcessingRef.current && audioQueueRef.current.length > 0) {
      processNextInQueue();
    }
  }, [processNextInQueue]);

  const startRecording = useCallback(async () => {
    try {
      if (!audioRecordingServiceRef.current) {
        console.error('Recording service not initialized');
        throw new Error('Recording service not initialized');
      }

      // Clear any existing chunks and transcribed text
      audioQueueRef.current = [];
      setTranscribedText('');

      setLoading({ status: 'loading', message: 'Starting recording...' });
      await audioRecordingServiceRef.current.startRecording();
      setIsRecording(true);
      setLoading({ status: 'processing', message: 'Recording and transcribing...' });
      console.log('Recording started successfully');
    } catch (error: any) {
      console.error('Error starting recording:', error);
      setLoading({ status: 'error', message: error.message });
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!audioRecordingServiceRef.current) {
      return;
    }

    console.log('Stopping recording...');
    setIsRecording(false);
    await audioRecordingServiceRef.current.stopRecording();
    
    console.log(`Stopped recording. ${audioQueueRef.current.length} chunks remaining to process`);
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