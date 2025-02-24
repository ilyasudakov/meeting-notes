import React, { useState } from 'react'
import AudioRecorder from '../components/AudioRecorder'
import './App.css'

const Popup: React.FC = () => {
  const [transcription, setTranscription] = useState<string>('')

  const handleTranscriptionComplete = (text: string) => {
    setTranscription(text)
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          </div>
          <h1>Meeting Notes</h1>
        </div>
        <p className="app-subtitle">Record, transcribe, and save your meeting notes with ease</p>
      </header>
      
      <main className="app-content">
        <AudioRecorder onTranscriptionComplete={handleTranscriptionComplete} />
      </main>
      
      <footer className="app-footer">
        <p>© {new Date().getFullYear()} Meeting Notes App • Powered by AI</p>
      </footer>
    </div>
  )
}

export default Popup 