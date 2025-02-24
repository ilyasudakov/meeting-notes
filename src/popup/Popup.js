import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import AudioRecorder from '../components/AudioRecorder';
const Popup = () => {
    const [transcription, setTranscription] = useState('');
    const handleTranscriptionComplete = (text) => {
        setTranscription(text);
    };
    return (_jsxs("div", { className: "popup", children: [_jsx("h1", { children: "Meeting Notes" }), _jsx(AudioRecorder, { onTranscriptionComplete: handleTranscriptionComplete })] }));
};
export default Popup;
