import React, { useState } from 'react'
import AudioRecorder from '../components/AudioRecorder'

const Popup: React.FC = () => {
  const [transcription, setTranscription] = useState<string>('')

  const handleTranscriptionComplete = (text: string) => {
    setTranscription(text)
  }

  return (
    <div className="popup">
      <h1>Meeting Notes</h1>
      <AudioRecorder onTranscriptionComplete={handleTranscriptionComplete} />
    </div>
  )
}

export default Popup 