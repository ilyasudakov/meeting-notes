import React, { useState } from 'react'

const Popup: React.FC = () => {
  const [count, setCount] = useState(0)

  return (
    <div className="popup">
      <h1>React Chrome Extension</h1>
      <p>This is a simple React Chrome Extension</p>
      <button onClick={() => setCount(count + 1)}>
        Count is: {count}
      </button>
    </div>
  )
}

export default Popup 