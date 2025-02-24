import React, { useState } from 'react';
import './Popup.css';

const Popup: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // TODO: Implement actual recording logic
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: isRecording ? 'STOP_RECORDING' : 'START_RECORDING'
        });
      }
    });
  };

  return (
    <div className="popup">
      <h1>Meet Transcriber</h1>
      <button 
        onClick={toggleRecording}
        className={`record-button ${isRecording ? 'recording' : ''}`}
      >
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>
      <div className="status">
        Status: {isRecording ? 'Recording...' : 'Ready'}
      </div>
    </div>
  );
};

export default Popup; 