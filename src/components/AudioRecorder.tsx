import React, { useState, useEffect } from 'react';
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

  const [recordingTime, setRecordingTime] = useState(0);
  const [visualizerValues, setVisualizerValues] = useState<number[]>(Array(20).fill(3));

  // Timer for recording duration
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRecording) {
      setRecordingTime(0);
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Animated visualizer effect
  useEffect(() => {
    let animationFrame: number;
    
    const updateVisualizer = () => {
      if (isRecording) {
        const newValues = visualizerValues.map(() => 
          Math.max(3, Math.floor(Math.random() * 50))
        );
        setVisualizerValues(newValues);
      } else {
        setVisualizerValues(Array(20).fill(3));
      }
      
      animationFrame = requestAnimationFrame(updateVisualizer);
    };
    
    if (isRecording) {
      animationFrame = requestAnimationFrame(updateVisualizer);
    }
    
    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [isRecording, visualizerValues]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="audio-recorder-container">
      <div className="audio-recorder-card">
        <div className="recorder-header">
          <h2>Voice Notes Transcription</h2>
          <p className="recorder-subtitle">Record your voice and get instant transcription</p>
        </div>
        
        <div className="visualizer-container">
          {visualizerValues.map((value, index) => (
            <div 
              key={index} 
              className="visualizer-bar" 
              style={{ 
                height: `${value}px`,
                opacity: isRecording ? 1 : 0.3,
                backgroundColor: isRecording ? '#ff4081' : '#ccc'
              }}
            />
          ))}
        </div>
        
        <div className="recorder-controls">
          <div className="recording-time">
            {isRecording && <div className="recording-indicator"></div>}
            <span>{isRecording ? formatTime(recordingTime) : 'Ready to record'}</span>
          </div>
          
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`record-button ${isRecording ? 'recording' : ''}`}
            disabled={loading.status === 'loading'}
            aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            <span className="button-icon"></span>
          </button>
          
          <div className="status-message">
            {loading.status !== 'idle' && (
              <div className={`status-indicator ${loading.status}`}>
                {loading.message}
                {loading.status === 'processing' && <span className="dots"><span>.</span><span>.</span><span>.</span></span>}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {transcribedText && (
        <div className="transcription-card">
          <h3>Transcription</h3>
          <div className="transcription-content">
            <p>{transcribedText}</p>
          </div>
          <div className="transcription-actions">
            <button className="action-button copy-button" onClick={() => navigator.clipboard.writeText(transcribedText)}>
              Copy Text
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder; 