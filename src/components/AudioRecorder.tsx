import React from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { AudioRecorderProps } from '../types/audio';
import './AudioRecorder.css';

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onTranscriptionComplete }) => {
  const {
    isRecording,
    loading,
    transcribedText,
    startRecording,
    stopRecording
  } = useAudioRecorder(onTranscriptionComplete);

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