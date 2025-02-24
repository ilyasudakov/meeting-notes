var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useCallback, useEffect } from 'react';
import { pipeline } from '@xenova/transformers';
import './AudioRecorder.css';
const AudioRecorder = ({ onTranscriptionComplete }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [loading, setLoading] = useState({ status: 'idle', message: '' });
    const [transcribedText, setTranscribedText] = useState('');
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const transcriptionIntervalRef = useRef(null);
    const transcriberRef = useRef(null);
    // Initialize the transcriber
    useEffect(() => {
        const initTranscriber = () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                setLoading({ status: 'loading', message: 'Initializing transcriber...' });
                if (!transcriberRef.current) {
                    console.log('Creating transcription pipeline...');
                    transcriberRef.current = yield pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
                    console.log('Transcription pipeline created successfully');
                }
                setLoading({ status: 'idle', message: '' });
            }
            catch (error) {
                console.error('Error initializing transcriber:', error);
                setLoading({ status: 'error', message: 'Failed to initialize transcriber' });
            }
        });
        initTranscriber();
    }, []);
    const convertBlobToAudioData = (blob) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const audioContext = new AudioContext();
            const arrayBuffer = yield blob.arrayBuffer();
            console.log('Audio blob size:', blob.size, 'bytes');
            const audioBuffer = yield audioContext.decodeAudioData(arrayBuffer);
            console.log('Decoded audio duration:', audioBuffer.duration, 'seconds');
            console.log('Sample rate:', audioBuffer.sampleRate, 'Hz');
            // Get audio data from the first channel
            const audioData = audioBuffer.getChannelData(0);
            console.log('Original audio data length:', audioData.length);
            // Resample to 16kHz if needed (Whisper's expected sample rate)
            if (audioBuffer.sampleRate !== 16000) {
                console.log('Resampling from', audioBuffer.sampleRate, 'Hz to 16000 Hz');
                const resampleRatio = 16000 / audioBuffer.sampleRate;
                const resampledLength = Math.floor(audioData.length * resampleRatio);
                const resampledData = new Float32Array(resampledLength);
                for (let i = 0; i < resampledLength; i++) {
                    const originalIndex = Math.floor(i / resampleRatio);
                    resampledData[i] = audioData[originalIndex];
                }
                console.log('Resampled audio data length:', resampledData.length);
                return resampledData;
            }
            return audioData;
        }
        catch (error) {
            console.error('Error converting audio:', error);
            throw new Error('Failed to convert audio data');
        }
    });
    const processAudioChunk = () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        if (audioChunksRef.current.length === 0) {
            console.log('No audio chunks to process');
            return;
        }
        try {
            setLoading({ status: 'processing', message: 'Processing audio chunk...' });
            console.log('Processing', audioChunksRef.current.length, 'audio chunks');
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
            console.log('Created audio blob of size:', audioBlob.size, 'bytes');
            if (audioBlob.size < 1000) {
                console.log('Audio blob too small, skipping processing');
                return;
            }
            const audioData = yield convertBlobToAudioData(audioBlob);
            console.log('Converted audio data length:', audioData.length);
            // Clear the chunks after processing
            audioChunksRef.current = [];
            if (!transcriberRef.current) {
                console.error('Transcriber not initialized');
                return;
            }
            console.log('Starting transcription...');
            try {
                const result = yield transcriberRef.current(audioData);
                console.log('Raw transcription result:', result);
                const text = Array.isArray(result)
                    ? ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.text) || ''
                    : result.text || '';
                console.log('Extracted text:', text);
                if (text.trim()) {
                    const newText = transcribedText ? transcribedText + ' ' + text : text;
                    setTranscribedText(newText);
                    if (onTranscriptionComplete) {
                        onTranscriptionComplete(newText);
                    }
                }
            }
            catch (transcriptionError) {
                console.error('Error during transcription:', transcriptionError);
                throw transcriptionError;
            }
            setLoading({ status: 'idle', message: '' });
        }
        catch (error) {
            console.error('Transcription error:', error);
            setLoading({ status: 'error', message: 'Error processing audio' });
        }
    });
    const startRecording = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            setLoading({ status: 'loading', message: 'Requesting microphone access...' });
            const stream = yield navigator.mediaDevices.getUserMedia({ audio: true });
            setLoading({ status: 'loading', message: 'Setting up recorder...' });
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            // Collect data every 5 seconds
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    console.log('Received audio chunk of size:', event.data.size, 'bytes');
                    audioChunksRef.current.push(event.data);
                }
            };
            // Start the transcription interval
            transcriptionIntervalRef.current = setInterval(processAudioChunk, 6000); // Process every 6 seconds
            mediaRecorder.start(5000); // Collect data every 5 seconds
            setIsRecording(true);
            setLoading({ status: 'processing', message: 'Recording and transcribing...' });
        }
        catch (error) {
            console.error('Error starting recording:', error);
            setLoading({ status: 'error', message: 'Error accessing microphone. Please check permissions.' });
        }
    }), [transcribedText, onTranscriptionComplete]);
    const stopRecording = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        if (mediaRecorderRef.current && isRecording) {
            try {
                // Process any remaining audio before stopping
                yield processAudioChunk();
                mediaRecorderRef.current.stop();
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
                // Clear the transcription interval
                if (transcriptionIntervalRef.current) {
                    clearInterval(transcriptionIntervalRef.current);
                    transcriptionIntervalRef.current = null;
                }
                setIsRecording(false);
                setLoading({ status: 'idle', message: '' });
            }
            catch (error) {
                console.error('Error stopping recording:', error);
                setLoading({ status: 'error', message: 'Error stopping recording' });
            }
        }
    }), [isRecording]);
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (transcriptionIntervalRef.current) {
                clearInterval(transcriptionIntervalRef.current);
            }
            if (mediaRecorderRef.current && isRecording) {
                mediaRecorderRef.current.stop();
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [isRecording]);
    return (_jsxs("div", { className: "audio-recorder", children: [_jsx("button", { onClick: isRecording ? stopRecording : startRecording, className: `record-button ${isRecording ? 'recording' : ''}`, disabled: loading.status === 'loading', children: isRecording ? 'Stop Recording' : 'Start Recording' }), loading.status !== 'idle' && (_jsxs("div", { className: `status-indicator ${loading.status}`, children: [loading.message, loading.status === 'processing' && _jsxs("span", { className: "dots", children: [_jsx("span", { children: "." }), _jsx("span", { children: "." }), _jsx("span", { children: "." })] })] })), transcribedText && (_jsxs("div", { className: "transcription-display", children: [_jsx("h3", { children: "Transcribed Text:" }), _jsx("p", { children: transcribedText })] }))] }));
};
export default AudioRecorder;
