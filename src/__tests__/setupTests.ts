// Add any global test setup here
import '@testing-library/jest-dom';

// Mock for window.URL.createObjectURL
if (typeof window !== 'undefined') {
  window.URL.createObjectURL = jest.fn(() => 'mock-url');
  window.URL.revokeObjectURL = jest.fn();
}

// Mock for AudioContext
class MockAudioContext {
  state = 'running';
  sampleRate = 44100;
  
  constructor() {}
  
  createMediaElementSource = jest.fn(() => ({
    connect: jest.fn()
  }));
  
  createMediaStreamDestination = jest.fn(() => ({
    stream: {}
  }));
  
  decodeAudioData = jest.fn().mockImplementation((buffer) => 
    Promise.resolve({
      duration: 1,
      numberOfChannels: 1,
      sampleRate: 44100,
      length: 44100,
      getChannelData: jest.fn().mockReturnValue(new Float32Array(44100))
    })
  );
  
  close = jest.fn().mockResolvedValue(undefined);
  resume = jest.fn().mockResolvedValue(undefined);
}

// Mock for Audio
class MockAudio {
  src = '';
  duration = 1;
  onloadedmetadata = jest.fn();
  play = jest.fn();
  
  constructor() {
    setTimeout(() => {
      if (this.onloadedmetadata) {
        this.onloadedmetadata();
      }
    }, 0);
  }
}

// Set up global mocks
global.AudioContext = MockAudioContext as any;
global.Audio = MockAudio as any;

// Instead of replacing the Blob class, we'll mock specific methods when needed in tests
// This avoids TypeScript errors with the global Blob interface 