import React, { useState, useEffect } from "react";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { AudioRecorderProps } from "../types/audio";
import "./AudioRecorder.css";

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onTranscriptionComplete,
}) => {
  const {
    isRecording,
    loading,
    transcribedText,
    startRecording,
    stopRecording,
  } = useAudioRecorder(onTranscriptionComplete);

  const [recordingTime, setRecordingTime] = useState(0);

  // Timer for recording duration
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRecording) {
      setRecordingTime(0);
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="audio-recorder-container">
      <div className="audio-recorder-card">
        <div className="recorder-controls">
          <div className="recording-time">
            {isRecording && <div className="recording-indicator"></div>}
            <span>
              {isRecording ? formatTime(recordingTime) : "Ready to record"}
            </span>
          </div>

          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`record-button ${isRecording ? "recording" : ""}`}
            disabled={loading.status === "loading"}
          >
            {isRecording ? "Stop" : "Start transcription"}
          </button>

          <div className="status-message">
            {loading.status !== "idle" && (
              <div className={`status-indicator ${loading.status}`}>
                {loading.message}
              </div>
            )}
          </div>
        </div>
      </div>

      {transcribedText && <p>{transcribedText}</p>}
    </div>
  );
};

export default AudioRecorder;
