import React, { useState, useRef, useCallback, useEffect } from 'react';
import { pipeline, AutomaticSpeechRecognitionOutput } from '@xenova/transformers';
import './AudioRecorder.css';

interface AudioRecorderProps {
  onTranscriptionComplete?: (text: string) => void;
}

interface LoadingState {
  status: 'idle' | 'loading' | 'processing' | 'error';
  message: string;
}

interface AudioChunk {
  blob: Blob;
  timestamp: number;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onTranscriptionComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState<LoadingState>({ status: 'idle', message: '' });
  const [transcribedText, setTranscribedText] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const isProcessingRef = useRef(false);
  const transcriberRef = useRef<any>(null);
  const audioQueueRef = useRef<AudioChunk[]>([]);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isRecordingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Keep isRecordingRef in sync with isRecording state
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Initialize the transcriber
  useEffect(() => {
    const initTranscriber = async () => {
      try {
        console.log('Starting transcriber initialization...');
        setLoading({ status: 'loading', message: 'Initializing transcriber...' });
        
        // Initialize AudioContext first
        if (!audioContextRef.current) {
          console.log('Creating new AudioContext...');
          audioContextRef.current = new AudioContext();
          console.log('AudioContext state:', audioContextRef.current.state);
          
          if (audioContextRef.current.state === 'suspended') {
            console.log('Resuming AudioContext...');
            await audioContextRef.current.resume();
            console.log('AudioContext resumed, new state:', audioContextRef.current.state);
          }
        }

        // Then initialize the transcriber
        if (!transcriberRef.current) {
          console.log('Creating transcription pipeline...');
          const pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
          console.log('Pipeline created, testing initialization...');
          
          // Create a short sine wave test audio sample
          const sampleRate = 16000;
          const duration = 1; // 1 second
          const frequency = 440; // 440 Hz tone
          const testData = new Float32Array(sampleRate * duration);
          for (let i = 0; i < testData.length; i++) {
              testData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
          }

          try {
            console.log('Testing pipeline with sine wave audio...');
            await pipe(testData, {
              task: 'transcribe',
              language: 'en',
            });
            console.log('Pipeline test successful');
            transcriberRef.current = pipe;
          } catch (testError) {
            console.error('Pipeline test failed:', testError);
            throw new Error('Failed to initialize transcriber: test failed');
          }
        }

        console.log('Initialization complete');
        setLoading({ status: 'idle', message: '' });
      } catch (error) {
        console.error('Detailed initialization error:', error);
        setLoading({ status: 'error', message: error instanceof Error ? error.message : 'Failed to initialize transcriber' });
      }
    };

    console.log('Running initialization...');
    initTranscriber().catch(error => {
      console.error('Top-level initialization error:', error);
    });

    return () => {
      console.log('Cleaning up transcriber...');
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      if (audioContextRef.current) {
        console.log('Closing AudioContext...');
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, []);

  const convertBlobToAudioData = async (blob: Blob): Promise<Float32Array> => {
    if (!audioContextRef.current) {
      throw new Error('AudioContext not initialized');
    }

    try {
      console.log('Starting audio conversion...');
      const arrayBuffer = await blob.arrayBuffer();
      console.log('Audio blob size:', blob.size, 'bytes');
      console.log('ArrayBuffer length:', arrayBuffer.byteLength);

      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      console.log('Audio decoded successfully:',
        '\nDuration:', audioBuffer.duration, 'seconds',
        '\nChannels:', audioBuffer.numberOfChannels,
        '\nSample Rate:', audioBuffer.sampleRate, 'Hz');

      // Get audio data from the first channel
      const audioData = audioBuffer.getChannelData(0);
      console.log('Original audio data length:', audioData.length);
      
      // Validate audio data
      const hasValidAudio = audioData.some(sample => sample !== 0);
      if (!hasValidAudio) {
        throw new Error('Audio data contains only zeros');
      }

      // Resample to 16kHz if needed (Whisper's expected sample rate)
      if (audioBuffer.sampleRate !== 16000) {
        console.log('Resampling from', audioBuffer.sampleRate, 'Hz to 16000 Hz');
        const resampleRatio = 16000 / audioBuffer.sampleRate;
        const resampledLength = Math.floor(audioData.length * resampleRatio);
        const resampledData = new Float32Array(resampledLength);
        
        for (let i = 0; i < resampledLength; i++) {
          const originalIndex = Math.floor(i / resampleRatio);
          resampledData[i] = audioData[originalIndex];
        }
        
        // Validate resampled data
        const hasValidResampled = resampledData.some(sample => sample !== 0);
        if (!hasValidResampled) {
          throw new Error('Resampled audio data contains only zeros');
        }

        console.log('Resampled audio data length:', resampledData.length);
        return resampledData;
      }
      
      return audioData;
    } catch (error: any) {
      console.error('Error converting audio:', error);
      throw new Error(`Failed to convert audio data: ${error.message}`);
    }
  };

  const processAudioChunk = useCallback(async (chunk: Blob) => {
    console.log('[DEBUG] Starting processAudioChunk:', {
      chunkSize: chunk.size,
      chunkType: chunk.type,
      transcriber: !!transcriberRef.current
    });

    // Validate minimum chunk size (100ms of audio at 16kHz = ~3200 bytes)
    if (chunk.size < 3200) {
      console.log('[DEBUG] Chunk too small, skipping');
      return;
    }

    try {
      setLoading({ status: 'processing', message: 'Processing audio chunk...' });
      
      if (!transcriberRef.current) {
        console.error('[DEBUG] Transcriber not initialized');
        throw new Error('Transcriber not initialized');
      }

      // Log audio format details
      console.log('[DEBUG] Processing audio format:', {
        type: chunk.type,
        size: chunk.size,
        timestamp: Date.now()
      });

      const audioData = await convertBlobToAudioData(chunk);
      
      // Validate audio data more thoroughly
      const stats = {
        length: audioData.length,
        hasData: audioData.some(x => x !== 0),
        min: Math.min(...audioData),
        max: Math.max(...audioData),
        rms: Math.sqrt(audioData.reduce((sum, x) => sum + x * x, 0) / audioData.length)
      };
      
      console.log('[DEBUG] Audio data statistics:', stats);
      
      // Skip processing if audio is too quiet
      if (stats.rms < 0.01) {
        console.log('[DEBUG] Audio too quiet, skipping transcription');
        return;
      }

      console.log('[DEBUG] Starting transcription...');
      const result = await transcriberRef.current(audioData, {
        task: 'transcribe',
        language: 'en',
        chunk_length_s: 30,
        return_timestamps: false
      });
      
      console.log('[DEBUG] Transcription result:', {
        raw: result,
        type: typeof result,
        hasText: Array.isArray(result) ? !!result[0]?.text : !!(result as AutomaticSpeechRecognitionOutput).text
      });
      
      const text = Array.isArray(result) 
        ? result[0]?.text || ''
        : (result as AutomaticSpeechRecognitionOutput).text || '';

      console.log('Extracted text:', text);

      if (text.trim()) {
        const newText = transcribedText ? transcribedText + ' ' + text : text;
        console.log('Setting new transcribed text:', newText);
        setTranscribedText(newText);
        if (onTranscriptionComplete) {
          onTranscriptionComplete(newText);
        }
      } else {
        console.log('No text extracted from transcription result');
      }
      
      setLoading({ status: 'idle', message: '' });
    } catch (error: any) {
      console.error('Detailed transcription error:', error);
      setLoading({ status: 'error', message: `Error processing audio: ${error.message}` });
      throw error;
    }
  }, [transcribedText, onTranscriptionComplete, convertBlobToAudioData]);

  const processNextInQueue = useCallback(async () => {
    if (!isRecordingRef.current || isProcessingRef.current || audioQueueRef.current.length === 0) {
      console.log('Skipping queue processing:',
        !isRecordingRef.current ? 'not recording' :
        isProcessingRef.current ? 'already processing' :
        'queue empty');
      return;
    }

    const chunk = audioQueueRef.current[0];
    if (!chunk) return;

    try {
      isProcessingRef.current = true;
      console.log('Processing chunk from queue, timestamp:', chunk.timestamp);
      await processAudioChunk(chunk.blob);
    } catch (error) {
      console.error('Error processing chunk:', error);
    } finally {
      isProcessingRef.current = false;
      audioQueueRef.current = audioQueueRef.current.slice(1);
      
      // Schedule next chunk processing
      if (isRecordingRef.current && audioQueueRef.current.length > 0) {
        console.log('Scheduling next chunk processing, queue length:', audioQueueRef.current.length);
        processingTimeoutRef.current = setTimeout(processNextInQueue, 100);
      }
    }
  }, [processAudioChunk]);

  const startRecording = useCallback(async () => {
    try {
      // First stop any existing recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      }

      setLoading({ status: 'loading', message: 'Requesting microphone access...' });
      
      // More detailed audio constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 44100
        } 
      });

      // Store stream reference
      streamRef.current = stream;
      
      // Check supported MIME types
      const supportedMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/webm',
        'audio/ogg',
        'audio/wav'
      ].filter(type => MediaRecorder.isTypeSupported(type));
      
      console.log('[DEBUG] Supported MIME types:', supportedMimeTypes);
      
      if (supportedMimeTypes.length === 0) {
        throw new Error('No supported audio MIME types found');
      }

      // Create MediaRecorder with specific options
      const options = {
        mimeType: supportedMimeTypes[0],
        audioBitsPerSecond: 128000
      };
      
      console.log('[DEBUG] Creating MediaRecorder with options:', options);
      
      // Clear previous state before creating new MediaRecorder
      audioQueueRef.current = [];
      isProcessingRef.current = false;
      
      setLoading({ status: 'loading', message: 'Setting up recorder...' });
      const mediaRecorder = new MediaRecorder(stream, options);
      
      console.log('[DEBUG] MediaRecorder created:', {
        mimeType: mediaRecorder.mimeType,
        state: mediaRecorder.state,
        audioBitsPerSecond: mediaRecorder.audioBitsPerSecond
      });

      mediaRecorderRef.current = mediaRecorder;

      // Set up error handler
      mediaRecorder.onerror = (event) => {
        console.error('[DEBUG] MediaRecorder error:', event);
        setLoading({ status: 'error', message: 'Recording error occurred' });
        stopRecording();
      };

      // Set up data handler
      mediaRecorder.ondataavailable = (event) => {
        // Only process if we're still recording
        if (!isRecordingRef.current) {
          console.log('[DEBUG] Ignoring data after stop');
          return;
        }

        console.log('[DEBUG] Data available event:', {
          size: event.data.size,
          type: event.data.type,
          timestamp: Date.now()
        });

        if (event.data && event.data.size > 0) {
          console.log('[DEBUG] Adding chunk to queue');
          audioQueueRef.current.push({
            blob: event.data,
            timestamp: Date.now()
          });
          
          if (!isProcessingRef.current && isRecordingRef.current) {
            console.log('[DEBUG] Triggering queue processing');
            processNextInQueue();
          }
        } else {
          console.warn('[DEBUG] Empty audio chunk received, ignoring');
        }
      };

      // Set up stop handler
      mediaRecorder.onstop = () => {
        console.log('[DEBUG] MediaRecorder stopped');
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => {
            console.log('[DEBUG] Stopping track:', track.kind, track.readyState);
            track.stop();
          });
          streamRef.current = null;
        }
      };

      // Set recording state before starting MediaRecorder
      setIsRecording(true);
      isRecordingRef.current = true;

      // Start recording with a larger timeslice (2000ms = 2 seconds)
      mediaRecorder.start(2000);
      
      console.log('[DEBUG] MediaRecorder started:', mediaRecorder.state);
      setLoading({ status: 'processing', message: 'Recording and transcribing...' });
    } catch (error) {
      console.error('[DEBUG] Error starting recording:', error);
      setLoading({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error accessing microphone' });
      // Clean up on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [processNextInQueue]);

  const stopRecording = useCallback(async () => {
    console.log('[DEBUG] Stopping recording...');
    isRecordingRef.current = false;
    setIsRecording(false);

    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          console.log('[DEBUG] Stopping MediaRecorder');
          mediaRecorderRef.current.stop();
        }
        
        // Stream cleanup is handled in onstop handler
      } catch (error) {
        console.error('[DEBUG] Error stopping recording:', error);
        setLoading({ status: 'error', message: 'Error stopping recording' });
      }
    }

    // Clear any pending processing
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }

    setLoading({ status: 'idle', message: '' });
  }, []);

  // Add cleanup effect
  useEffect(() => {
    return () => {
      console.log('[DEBUG] Component cleanup');
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="audio-recorder">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`record-button ${isRecording ? 'recording' : ''}`}
        disabled={loading.status === 'loading'}
      >
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>
      
      {loading.status !== 'idle' && (
        <div className={`status-indicator ${loading.status}`}>
          {loading.message}
          {loading.status === 'processing' && <span className="dots"><span>.</span><span>.</span><span>.</span></span>}
        </div>
      )}
      
      {transcribedText && (
        <div className="transcription-display">
          <h3>Transcribed Text:</h3>
          <p>{transcribedText}</p>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder; 