export class AudioProcessingService {
  private audioContext: AudioContext | null = null;

  constructor() {
    this.audioContext = new AudioContext();
  }

  async convertBlobToAudioData(blob: Blob): Promise<Float32Array> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    try {
      let audioBuffer: AudioBuffer;

      try {
        const arrayBuffer = await blob.arrayBuffer();
        audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      } catch (decodeError) {
        // Fallback: If decoding fails, try to convert to WAV first
        audioBuffer = await this.convertToWavAndDecode(blob);
      }

      // Get audio data from the first channel and resample
      return this.resampleAudio(audioBuffer);
    } catch (error: any) {
      throw new Error(`Failed to convert audio data: ${error.message}`);
    }
  }

  private async convertToWavAndDecode(blob: Blob): Promise<AudioBuffer> {
    const audioElement = new Audio();
    const audioUrl = URL.createObjectURL(blob);
    audioElement.src = audioUrl;
    
    await new Promise((resolve) => {
      audioElement.onloadedmetadata = resolve;
    });
    
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
    
    const wavBlob = new Blob(chunks, { type: 'audio/wav' });
    const wavArrayBuffer = await wavBlob.arrayBuffer();
    
    URL.revokeObjectURL(audioUrl);
    return this.audioContext!.decodeAudioData(wavArrayBuffer);
  }

  private resampleAudio(audioBuffer: AudioBuffer): Float32Array {
    const originalAudioData = audioBuffer.getChannelData(0);
    const targetSampleRate = 16000;
    const resampleRatio = targetSampleRate / audioBuffer.sampleRate;
    const resampledLength = Math.floor(originalAudioData.length * resampleRatio);
    const resampledData = new Float32Array(resampledLength);

    // Linear interpolation resampling
    for (let i = 0; i < resampledLength; i++) {
      const originalIndex = i / resampleRatio;
      const index1 = Math.floor(originalIndex);
      const index2 = Math.min(Math.ceil(originalIndex), originalAudioData.length - 1);
      const fraction = originalIndex - index1;
      resampledData[i] = (1 - fraction) * originalAudioData[index1] + fraction * originalAudioData[index2];
    }

    // Normalize audio
    const maxAmp = Math.max(...resampledData.map(Math.abs));
    if (maxAmp > 0) {
      for (let i = 0; i < resampledData.length; i++) {
        resampledData[i] = resampledData[i] / maxAmp;
      }
    }

    return resampledData;
  }

  async cleanup(): Promise<void> {
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }
} 