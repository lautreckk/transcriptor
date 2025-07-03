import React, { useState, useRef } from 'react';
import { supabase } from './supabase';
import './App.css';
import { FFmpeg } from '@ffmpeg/ffmpeg';

function App() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [transcription, setTranscription] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ffmpeg = React.useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder|null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordedAudio, setRecordedAudio] = useState<string|null>(null);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [language, setLanguage] = useState<string>('');
  const languageOptions = [
    { label: 'Português', value: 'pt' },
    { label: 'Inglês', value: 'en' },
    { label: 'Espanhol', value: 'es' },
    { label: 'Francês', value: 'fr' },
    { label: 'Alemão', value: 'de' },
    { label: 'Italiano', value: 'it' },
    { label: 'Japonês', value: 'ja' },
    { label: 'Chinês', value: 'zh' },
    { label: 'Outro', value: 'auto' },
  ];

  React.useEffect(() => {
    ffmpeg.current = new FFmpeg();
  }, []);

  // Utilitário para ler arquivo como ArrayBuffer
  const readFileAsArrayBuffer = (file: File): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(new Uint8Array(reader.result as ArrayBuffer));
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!language) {
      setError('Por favor, selecione a linguagem do áudio.');
      return;
    }
    const file = event.target.files?.[0];
    if (file) {
      const isMp3 = file.type === 'audio/mp3' || file.name.endsWith('.mp3');
      const isMp4 = file.type === 'video/mp4' || file.name.endsWith('.mp4');
      if (!isMp3 && !isMp4) {
        setError('Por favor, selecione apenas arquivos MP3 ou MP4.');
        return;
      }
      processAndUpload(file, isMp4);
    }
  };

  const processAndUpload = async (file: File, isMp4: boolean) => {
    if (!language) {
      setError('Por favor, selecione a linguagem do áudio.');
      return;
    }
    if (!isMp4) {
      await splitAndUpload(file);
      return;
    }
    setIsUploading(true);
    setError('');
    setTranscription('');
    setUploadProgress(0);
    setIsTranscribing(false);
    try {
      if (!ffmpeg.current.loaded) {
        await ffmpeg.current.load();
      }
      const fileData = await readFileAsArrayBuffer(file);
      await ffmpeg.current.writeFile('input.mp4', fileData);
      await ffmpeg.current.exec([
        '-i', 'input.mp4',
        '-vn', // remove video
        '-ar', '44100',
        '-ac', '2',
        '-b:a', '192k',
        'output.mp3'
      ]);
      const mp3Data = await ffmpeg.current.readFile('output.mp3');
      const mp3Blob = new Blob([mp3Data.buffer], { type: 'audio/mp3' });
      const mp3File = new File([mp3Blob], file.name.replace(/\.mp4$/, '.mp3'), { type: 'audio/mp3' });
      await splitAndUpload(mp3File);
    } catch (err) {
      setError('Erro ao converter vídeo para áudio.');
    } finally {
      setIsUploading(false);
    }
  };

  const splitAndUpload = async (file: File) => {
    setIsUploading(true);
    setError('');
    setTranscription('');
    setUploadProgress(0);
    setIsTranscribing(false);

    try {
      if (!ffmpeg.current.loaded) {
        await ffmpeg.current.load();
      }
      const fileData = await readFileAsArrayBuffer(file);
      await ffmpeg.current.writeFile('input.mp3', fileData);

      // Obter duração do áudio de forma robusta via evento de log
      let duration = 0;
      const logHandler = ({ message }: { message: string }) => {
        const match = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(message);
        if (match) {
          const hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const seconds = parseFloat(match[3]);
          duration = hours * 3600 + minutes * 60 + seconds;
        }
      };
      ffmpeg.current.on('log', logHandler);
      try {
        await ffmpeg.current.exec([
          '-i', 'input.mp3',
          '-f', 'null', '-'
        ]);
      } catch (e) {
        // Não precisa tratar aqui, só queremos o log
      }
      ffmpeg.current.off('log', logHandler);
      if (!duration) {
        setError('Não foi possível obter a duração do áudio.');
        setIsUploading(false);
        return;
      }
      const chunkDuration = 60; // 1 minuto
      const chunkCount = Math.ceil(duration / chunkDuration);
      const requestId = Date.now().toString();
      const urls: string[] = [];

      for (let i = 0; i < chunkCount; i++) {
        setUploadProgress((i / chunkCount) * 100);
        const start = i * chunkDuration;
        const outputName = `chunk_${i}.mp3`;
        await ffmpeg.current.exec([
          '-ss', `${start}`,
          '-t', `${chunkDuration}`,
          '-i', 'input.mp3',
          '-acodec', 'copy',
          outputName
        ]);
        const data = await ffmpeg.current.readFile(outputName);
        const blob = new Blob([data.buffer], { type: 'audio/mp3' });
        const chunkFile = new File([blob], outputName, { type: 'audio/mp3' });
        // Upload para o Supabase
        const { error: uploadError } = await supabase.storage
          .from('audio-files')
          .upload(`${requestId}/${outputName}`, chunkFile);
        if (uploadError) {
          setError(`Erro no upload do chunk ${i}: ${uploadError.message}`);
          continue;
        }
        // Obtenha a URL pública
        const { data: urlData } = supabase.storage
          .from('audio-files')
          .getPublicUrl(`${requestId}/${outputName}`);
        urls.push(urlData.publicUrl);
      }
      setUploadProgress(100);
      setIsTranscribing(true);
      // Envie as URLs para o webhook
      const response = await fetch('https://webhook.gabrielsena.net/webhook/transcritor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          audioUrls: urls,
          language
        })
      });
      if (!response.ok) {
        throw new Error('Erro ao enviar URLs para o webhook');
      }
      const data = await response.json();
      setTranscription(data.transcription || 'Transcrição enviada para processamento.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsUploading(false);
      setIsTranscribing(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'audio/mp3' || file.name.endsWith('.mp3')) {
        splitAndUpload(file);
      } else {
        setError('Por favor, selecione apenas arquivos MP3.');
      }
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  // Gravação de áudio
  const handleStartRecording = async () => {
    if (!language) {
      setError('Por favor, selecione a linguagem do áudio.');
      return;
    }
    setError('');
    setRecordedAudio(null);
    setRecordedChunks([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);
      setIsRecording(true);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          setRecordedChunks((prev) => [...prev, e.data]);
        }
      };
      recorder.onstop = async () => {
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedAudio(url);
        await handleSendRecording();
      };
      recorder.start();
    } catch (err) {
      setError('Não foi possível acessar o microfone.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  // Envia a gravação para o fluxo de transcrição
  const handleSendRecording = async () => {
    if (!recordedChunks.length) return;
    setIsUploadingRecording(true);
    setError('');
    setTranscription('');
    setUploadProgress(0);
    setIsTranscribing(false);
    try {
      // Converte para MP3 usando ffmpeg.wasm
      if (!ffmpeg.current.loaded) {
        await ffmpeg.current.load();
      }
      const webmBlob = new Blob(recordedChunks, { type: 'audio/webm' });
      const arrayBuffer = await webmBlob.arrayBuffer();
      await ffmpeg.current.writeFile('input.webm', new Uint8Array(arrayBuffer));
      await ffmpeg.current.exec([
        '-i', 'input.webm',
        '-ar', '44100',
        '-ac', '2',
        '-b:a', '192k',
        'output.mp3'
      ]);
      const mp3Data = await ffmpeg.current.readFile('output.mp3');
      const mp3Blob = new Blob([mp3Data.buffer], { type: 'audio/mp3' });
      const mp3File = new File([mp3Blob], 'gravacao.mp3', { type: 'audio/mp3' });
      await splitAndUpload(mp3File);
    } catch (err) {
      setError('Erro ao processar a gravação.');
    } finally {
      setIsUploadingRecording(false);
    }
  };

  return (
    <div className="vertical-container">
      <div className="profile-box">
        <div className="profile-top-row">
          <img
            src="https://nawyofpkjolknmlccdkv.supabase.co/storage/v1/object/public/audio-files/gabriel/freepik__gabrielsena-cyberpunk-futuristic__30049.jpeg"
            alt="Gabriel de Sena"
            className="avatar-img-small"
          />
          <div className="profile-name-version">
            <div className="profile-name">Gabriel de Sena</div>
            <div className="app-version">v1.0</div>
          </div>
        </div>
        <div className="profile-bio">
          Desenvolvedor apaixonado por tecnologia, automação e IA. Vamos conectar!
        </div>
        <div className="profile-links">
          <a href="https://www.instagram.com/gabrielsena.ai/" target="_blank" rel="noopener noreferrer" className="profile-link" title="Instagram">
            <img src="https://nawyofpkjolknmlccdkv.supabase.co/storage/v1/object/public/audio-files/gabriel/instagram.png" alt="Instagram" className="profile-icon-img" />
          </a>
          <a href="https://www.youtube.com/channel/UCmawC_qSrOSW1eq_IRibWlw/" target="_blank" rel="noopener noreferrer" className="profile-link" title="YouTube">
            <img src="https://nawyofpkjolknmlccdkv.supabase.co/storage/v1/object/public/audio-files/gabriel/youtube.png" alt="YouTube" className="profile-icon-img" />
          </a>
          <a href="https://wa.me/5547920020811?text=Vim%20do%20site%20de%20transcri%C3%A7%C3%A3o%20de%20%C3%A1udios%2C%20quero%20falar%20com%20voc%C3%AA!" target="_blank" rel="noopener noreferrer" className="profile-link" title="WhatsApp">
            <img src="https://nawyofpkjolknmlccdkv.supabase.co/storage/v1/object/public/audio-files/gabriel/whatsapp.png" alt="WhatsApp" className="profile-icon-img" />
          </a>
          <a href="https://discord.gg/f442Wfgyhy" target="_blank" rel="noopener noreferrer" className="profile-link" title="Discord">
            <img src="https://nawyofpkjolknmlccdkv.supabase.co/storage/v1/object/public/audio-files/gabriel/discord.png" alt="Discord" className="profile-icon-img" />
          </a>
        </div>
      </div>
      <div className="container">
        <h1 className="title">Transcritor de Áudio</h1>
        <div className="headline">100% Grátis</div>
        <div className="subheadline">Seus áudios não ficam gravados, é criptografado e excluído do banco de dados, relaxe!</div>
        <div style={{ margin: '0 auto 18px auto', maxWidth: 320 }}>
          <label htmlFor="language-select" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Selecione a linguagem do áudio *</label>
          <select
            id="language-select"
            value={language}
            onChange={e => setLanguage(e.target.value)}
            className="language-select"
            required
          >
            <option value="">Selecione...</option>
            {languageOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 16 }}>
          <button
            className="record-btn"
            onClick={handleStartRecording}
            disabled={isRecording || isUploading || isUploadingRecording}
            style={{ background: isRecording ? '#eee' : '#fff' }}
          >
            {isRecording ? 'Gravando...' : 'Gravar áudio'}
          </button>
          <button
            className="stop-btn"
            onClick={handleStopRecording}
            disabled={!isRecording}
          >
            Parar gravação
          </button>
        </div>
        {recordedAudio && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <audio src={recordedAudio} controls style={{ width: '100%' }} />
          </div>
        )}
        <div 
          className="upload-area"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,audio/mp3,.mp4,video/mp4"
            onChange={handleFileSelect}
            className="file-input"
            id="file-input"
          />
          <label htmlFor="file-input" className="upload-label">
            <div className="upload-content">
              <div className="upload-icon">🎵</div>
              <p className="upload-text">
                {isUploading ? 'Fazendo upload...' : 'Clique ou arraste um arquivo MP3 ou MP4 aqui'}
              </p>
              <p className="upload-subtext">Apenas arquivos MP3 ou MP4 são aceitos</p>
            </div>
          </label>
        </div>
        {isUploading && (
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="progress-text">{Math.round(uploadProgress)}%</p>
          </div>
        )}
        {isTranscribing && (
          <div className="transcribing">
            <div className="loading-spinner"></div>
            <p>Transcrevendo áudio...</p>
          </div>
        )}
        {error && (
          <div className="error">
            <p>{error}</p>
          </div>
        )}
        {transcription && (
          <div className="transcription-container">
            <h2>Transcrição</h2>
            <button
              className="copy-btn"
              style={{ display: 'block', margin: '0 auto 15px auto' }}
              onClick={() => {
                navigator.clipboard.writeText(transcription);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? 'Copiado!' : 'Copiar texto'}
            </button>
            <div className="transcription-text">
              {transcription}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App; 