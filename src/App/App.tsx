import React, { useState, useEffect } from "react";
import AudioRecorder from "../components/AudioRecorder";
import { configureLogging } from "../utils/configureLogging";
import { LogLevel } from "../utils/logger";
import "./App.css";

const App: React.FC = () => {
  const [transcription, setTranscription] = useState<string>("");

  // Configure logging when the app initializes
  useEffect(() => {
    // Set to DEBUG level during development, or INFO/ERROR in production
    // You can adjust this based on your needs
    if (process.env.NODE_ENV === "development") {
      configureLogging(LogLevel.DEBUG);
    } else {
      configureLogging(LogLevel.INFO);
    }
  }, []);

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
