import { AudioRecordingService } from '../../services/audioRecordingService';

// Create mock implementations
const mockMediaRecorder = {
  start: jest.fn(),
  stop: jest.fn(),
  state: 'recording',
  ondataavailable: null as any,
  onerror: null as any,
  onstop: null as any
};

// Mock stream
const mockStream = {
  getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }])
};

// Setup mocks before tests
beforeAll(() => {
  // Mock MediaRecorder
  global.MediaRecorder = jest.fn().mockImplementation(() => mockMediaRecorder) as any;
  
  // Mock isTypeSupported
  global.MediaRecorder.isTypeSupported = jest.fn().mockReturnValue(true);
  
  // Mock getUserMedia
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: {
      getUserMedia: jest.fn().mockResolvedValue(mockStream)
    },
    writable: true
  });
});

describe('AudioRecordingService', () => {
  let service: AudioRecordingService;
  let onDataAvailableMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    onDataAvailableMock = jest.fn();
    service = new AudioRecordingService(onDataAvailableMock);
  });

  test('startRecording should initialize MediaRecorder', async () => {
    await service.startRecording();
    
    // Check if getUserMedia was called with correct parameters
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 16000
      }
    });
    
    // Check if MediaRecorder was initialized
    expect(MediaRecorder).toHaveBeenCalled();
    
    // Check if recording started
    expect(service.isRecording()).toBe(true);
  });

  test('stopRecording should stop MediaRecorder and clean up', async () => {
    await service.startRecording();
    await service.stopRecording();
    
    // Check if stop was called
    expect(mockMediaRecorder.stop).toHaveBeenCalled();
    
    // Check if tracks were stopped
    expect(mockStream.getTracks).toHaveBeenCalled();
    expect(mockStream.getTracks()[0].stop).toHaveBeenCalled();
    
    // Check if recording is stopped
    expect(service.isRecording()).toBe(false);
  });

  test('should handle data available events', async () => {
    await service.startRecording();
    
    // Simulate data available event
    const mockEvent = {
      data: new Blob(['test data'], { type: 'audio/wav' })
    };
    
    // Call the ondataavailable handler that was set during startRecording
    mockMediaRecorder.ondataavailable(mockEvent);
    
    // Check if onDataAvailable callback was called with correct data
    expect(onDataAvailableMock).toHaveBeenCalledWith(expect.objectContaining({
      blob: mockEvent.data,
      timestamp: expect.any(Number)
    }));
  });

  test('should handle errors during recording', async () => {
    // Mock getUserMedia to reject
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValueOnce(new Error('Permission denied'));
    
    // Expect startRecording to throw
    await expect(service.startRecording()).rejects.toThrow('Permission denied');
    
    // Check that we're not recording
    expect(service.isRecording()).toBe(false);
  });
}); 