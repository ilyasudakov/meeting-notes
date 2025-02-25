import React, { useState } from "react";
import AudioRecorder from "../components/AudioRecorder";
import "./App.css";

const App: React.FC = () => {
  const [transcription, setTranscription] = useState<string>("");

  const handleTranscriptionComplete = (text: string) => {
    setTranscription(text);
  };

  return (
    <div className="app-container">
      <main className="app-content">
        <AudioRecorder onTranscriptionComplete={handleTranscriptionComplete} />
      </main>
    </div>
  );
};

export default App;
