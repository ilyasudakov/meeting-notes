export class AudioProcessingService {
  private audioContext: AudioContext | null = null;

  constructor() {
    try {
      this.audioContext = new AudioContext();
      console.log('AudioProcessingService initialized with sample rate:', this.audioContext.sampleRate);
    } catch (error) {
      console.error('Failed to create AudioContext:', error);
      throw error;
    }
  }

  async convertBlobToAudioData(blob: Blob): Promise<Float32Array> {
    if (!this.audioContext) {
      console.error('AudioContext not initialized');
      throw new Error('AudioContext not initialized');
    }

    try {
      console.log('Converting audio blob, size:', blob.size);
      let audioBuffer: AudioBuffer;

      try {
        console.log('Attempting direct audio decoding...');
        const arrayBuffer = await blob.arrayBuffer();
        audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        console.log('Direct audio decoding successful');
      } catch (decodeError) {
        console.log('Direct decoding failed, attempting WAV conversion:', decodeError);
        // Fallback: If decoding fails, try to convert to WAV first
        audioBuffer = await this.convertToWavAndDecode(blob);
      }

      // Get audio data from the first channel and resample
      console.log('Processing audio buffer, duration:', audioBuffer.duration);
      const resampledData = this.resampleAudio(audioBuffer);
      console.log('Audio processing completed, samples:', resampledData.length);
      return resampledData;
    } catch (error: any) {
      console.error('Failed to convert audio data:', error);
      throw new Error(`Failed to convert audio data: ${error.message}`);
    }
  }

  private async convertToWavAndDecode(blob: Blob): Promise<AudioBuffer> {
    console.log('Starting WAV conversion...');
    const audioElement = new Audio();
    const audioUrl = URL.createObjectURL(blob);
    audioElement.src = audioUrl;
    
    await new Promise((resolve) => {
      audioElement.onloadedmetadata = resolve;
    });
    
    console.log('Audio metadata loaded, duration:', audioElement.duration);
    const tempContext = new AudioContext();
    const source = tempContext.createMediaElementSource(audioElement);
    const destination = tempContext.createMediaStreamDestination();
    source.connect(destination);
    
    const mediaRecorder = new MediaRecorder(destination.stream);
    const chunks: Blob[] = [];
    
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    
    await new Promise<void>((resolve) => {
      mediaRecorder.onstop = () => resolve();
      mediaRecorder.start();
      audioElement.play();
      setTimeout(() => mediaRecorder.stop(), audioElement.duration * 1000);
    });
    
    console.log('WAV conversion completed');
    const wavBlob = new Blob(chunks, { type: 'audio/wav' });
    const wavArrayBuffer = await wavBlob.arrayBuffer();
    
    URL.revokeObjectURL(audioUrl);
    return this.audioContext!.decodeAudioData(wavArrayBuffer);
  }

  private resampleAudio(audioBuffer: AudioBuffer): Float32Array {
    console.log('Resampling audio, original sample rate:', audioBuffer.sampleRate);
    const originalAudioData = audioBuffer.getChannelData(0);
    const targetSampleRate = 16000;
    const resampleRatio = targetSampleRate / audioBuffer.sampleRate;
    const resampledLength = Math.floor(originalAudioData.length * resampleRatio);
    const resampledData = new Float32Array(resampledLength);

    // Linear interpolation resampling with chunked processing
    const chunkSize = 10000; // Process in smaller chunks to avoid stack overflow
    let maxAmp = 0;

    for (let i = 0; i < resampledLength; i += chunkSize) {
      const endIndex = Math.min(i + chunkSize, resampledLength);
      
      // Process a chunk
      for (let j = i; j < endIndex; j++) {
        const originalIndex = j / resampleRatio;
        const index1 = Math.floor(originalIndex);
        const index2 = Math.min(Math.ceil(originalIndex), originalAudioData.length - 1);
        const fraction = originalIndex - index1;
        
        const interpolatedValue = (1 - fraction) * originalAudioData[index1] + fraction * originalAudioData[index2];
        resampledData[j] = interpolatedValue;
        
        // Track maximum amplitude
        const absValue = Math.abs(interpolatedValue);
        if (absValue > maxAmp) {
          maxAmp = absValue;
        }
      }
    }

    // Normalize audio if needed
    if (maxAmp > 0 && maxAmp !== 1) {
      const normalizeRatio = 1 / maxAmp;
      for (let i = 0; i < resampledLength; i += chunkSize) {
        const endIndex = Math.min(i + chunkSize, resampledLength);
        for (let j = i; j < endIndex; j++) {
          resampledData[j] *= normalizeRatio;
        }
      }
    }

    console.log('Resampling completed, new length:', resampledData.length);
    return resampledData;
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up audio processing resources');
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }
} 