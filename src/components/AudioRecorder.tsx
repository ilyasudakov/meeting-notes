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

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onTranscriptionComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState<LoadingState>({ status: 'idle', message: '' });
  const [transcribedText, setTranscribedText] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transcriberRef = useRef<any>(null);

  // Initialize the transcriber
  useEffect(() => {
    const initTranscriber = async () => {
      try {
        setLoading({ status: 'loading', message: 'Initializing transcriber...' });
        if (!transcriberRef.current) {
          console.log('Creating transcription pipeline...');
          transcriberRef.current = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
          console.log('Transcription pipeline created successfully');
        }
        setLoading({ status: 'idle', message: '' });
      } catch (error) {
        console.error('Error initializing transcriber:', error);
        setLoading({ status: 'error', message: 'Failed to initialize transcriber' });
      }
    };
    initTranscriber();
  }, []);

  const convertBlobToAudioData = async (blob: Blob): Promise<Float32Array> => {
    try {
      const audioContext = new AudioContext();
      const arrayBuffer = await blob.arrayBuffer();
      console.log('Audio blob size:', blob.size, 'bytes');
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log('Decoded audio duration:', audioBuffer.duration, 'seconds');
      console.log('Sample rate:', audioBuffer.sampleRate, 'Hz');
      
      // Get audio data from the first channel
      const audioData = audioBuffer.getChannelData(0);
      console.log('Original audio data length:', audioData.length);
      
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
        
        console.log('Resampled audio data length:', resampledData.length);
        return resampledData;
      }
      
      return audioData;
    } catch (error) {
      console.error('Error converting audio:', error);
      throw new Error('Failed to convert audio data');
    }
  };

  const processAudioChunk = async () => {
    if (audioChunksRef.current.length === 0) {
      console.log('No audio chunks to process');
      return;
    }

    try {
      setLoading({ status: 'processing', message: 'Processing audio chunk...' });
      console.log('Processing', audioChunksRef.current.length, 'audio chunks');
      
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
      console.log('Created audio blob of size:', audioBlob.size, 'bytes');
      
      if (audioBlob.size < 1000) {
        console.log('Audio blob too small, skipping processing');
        return;
      }

      const audioData = await convertBlobToAudioData(audioBlob);
      console.log('Converted audio data length:', audioData.length);
      
      // Clear the chunks after processing
      audioChunksRef.current = [];
      
      if (!transcriberRef.current) {
        console.error('Transcriber not initialized');
        return;
      }

      console.log('Starting transcription...');
      try {
        const result = await transcriberRef.current(audioData);
        console.log('Raw transcription result:', result);
        
        const text = Array.isArray(result) 
          ? result[0]?.text || ''
          : (result as AutomaticSpeechRecognitionOutput).text || '';

        console.log('Extracted text:', text);

        if (text.trim()) {
          const newText = transcribedText ? transcribedText + ' ' + text : text;
          setTranscribedText(newText);
          if (onTranscriptionComplete) {
            onTranscriptionComplete(newText);
          }
        }
      } catch (transcriptionError) {
        console.error('Error during transcription:', transcriptionError);
        throw transcriptionError;
      }
      
      setLoading({ status: 'idle', message: '' });
    } catch (error) {
      console.error('Transcription error:', error);
      setLoading({ status: 'error', message: 'Error processing audio' });
    }
  };

  const startRecording = useCallback(async () => {
    try {
      setLoading({ status: 'loading', message: 'Requesting microphone access...' });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      setLoading({ status: 'loading', message: 'Setting up recorder...' });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Collect data every 5 seconds
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('Received audio chunk of size:', event.data.size, 'bytes');
          audioChunksRef.current.push(event.data);
        }
      };

      // Start the transcription interval
      transcriptionIntervalRef.current = setInterval(processAudioChunk, 6000); // Process every 6 seconds

      mediaRecorder.start(5000); // Collect data every 5 seconds
      setIsRecording(true);
      setLoading({ status: 'processing', message: 'Recording and transcribing...' });
    } catch (error) {
      console.error('Error starting recording:', error);
      setLoading({ status: 'error', message: 'Error accessing microphone. Please check permissions.' });
    }
  }, [transcribedText, onTranscriptionComplete]);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        // Process any remaining audio before stopping
        await processAudioChunk();
        
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        
        // Clear the transcription interval
        if (transcriptionIntervalRef.current) {
          clearInterval(transcriptionIntervalRef.current);
          transcriptionIntervalRef.current = null;
        }

        setIsRecording(false);
        setLoading({ status: 'idle', message: '' });
      } catch (error) {
        console.error('Error stopping recording:', error);
        setLoading({ status: 'error', message: 'Error stopping recording' });
      }
    }
  }, [isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transcriptionIntervalRef.current) {
        clearInterval(transcriptionIntervalRef.current);
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isRecording]);

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