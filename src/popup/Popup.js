import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
const Popup = () => {
    const [count, setCount] = useState(0);
    return (_jsxs("div", { className: "popup", children: [_jsx("h1", { children: "React Chrome Extension" }), _jsx("p", { children: "This is a simple React Chrome Extension" }), _jsxs("button", { onClick: () => setCount(count + 1), children: ["Count is: ", count] })] }));
};
export default Popup;
