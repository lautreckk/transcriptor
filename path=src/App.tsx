import React, { useState } from 'react';

const [copied, setCopied] = useState(false);

{transcription && (
  <div className="transcription-container">
    <h2>Transcrição</h2>
    <div className="transcription-text">
      {transcription}
    </div>
    <button
      className="copy-btn"
      onClick={() => {
        navigator.clipboard.writeText(transcription);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? 'Copiado!' : 'Copiar texto'}
    </button>
  </div>
)} 