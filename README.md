# Meeting Notes

A simple web application for recording, transcribing, and saving meeting notes using speech recognition.

## Overview

Meeting Notes is a lightweight application that allows users to record audio and get real-time transcription. The application uses the browser's built-in audio recording capabilities and the Whisper speech recognition model from Xenova to provide accurate transcriptions.

## Features

- Audio recording with a simple start/stop interface
- Real-time transcription with minimal delay
- Clean, minimalist UI
- Displays recording duration and status

## Architecture

The application is built using React and TypeScript, with a modular architecture that separates concerns into services, hooks, and components.

### Components

#### `App`
The main application component that renders the header and the AudioRecorder component.

#### `AudioRecorder`
A React component that provides the user interface for recording and displaying transcriptions. It includes:
- Recording controls (start/stop button)
- Recording timer
- Status indicators
- Transcription display

### Services

#### `AudioRecordingService`
Handles the audio recording functionality using the MediaRecorder API:
- Manages microphone access
- Creates and configures the MediaRecorder
- Captures audio chunks and passes them to the callback
- Handles starting and stopping recording

#### `AudioProcessingService`
Processes the raw audio data for transcription:
- Converts audio blobs to audio data
- Resamples audio to the required format (16kHz)
- Provides fallback mechanisms for audio decoding failures

#### `TranscriptionService`
Handles the speech-to-text conversion:
- Initializes the Whisper model from Xenova
- Transcribes audio data to text
- Filters out silent or empty audio

### Hooks

#### `useAudioRecorder`
A custom React hook that coordinates the recording and transcription process:
- Initializes and manages the services
- Handles the audio processing queue
- Updates the UI state based on recording status
- Provides the transcribed text

### Data Flow

1. User clicks "Start Recording" button
2. `useAudioRecorder` hook calls `startRecording` on the `AudioRecordingService`
3. `AudioRecordingService` accesses the microphone and starts recording
4. Audio chunks are captured and passed to the callback function
5. Each chunk is added to a queue in `useAudioRecorder`
6. `processNextChunk` processes each chunk:
   - Converts the blob to audio data using `AudioProcessingService`
   - Sends the audio data to `TranscriptionService` for transcription
   - Updates the UI with the transcribed text
7. User clicks "Stop Recording" to end the session

## Technical Details

### Audio Processing

- Audio is captured in 3-second chunks
- Audio is resampled to 16kHz for optimal transcription
- Silent audio is filtered out to avoid unnecessary processing

### Transcription

- Uses the Xenova/whisper-tiny.en model for speech recognition
- Processes audio in chunks for near real-time transcription
- Concatenates transcription results for a complete transcript

## Error Handling

The application includes robust error handling:
- Fallback mechanisms for audio decoding failures
- Graceful handling of transcription errors
- User-friendly error messages

## Simplified Design

The application has been streamlined to focus on core functionality:
- Minimalist UI with essential controls
- Efficient audio processing pipeline
- Focused error handling
- Clear separation of concerns

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm run dev
   ```

### Building for Production

```
npm run build
```

## License

[MIT License](LICENSE) 