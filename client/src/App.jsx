import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [prompt, setPrompt] = useState('');
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessages, setStatusMessages] = useState([]);
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('designHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('GigaChat-2-Pro');

  useEffect(() => {
    const savedPrompt = localStorage.getItem('lastPrompt');
    const savedHtml = localStorage.getItem('lastHtml');
    if (savedPrompt) setPrompt(savedPrompt);
    if (savedHtml) setHtml(savedHtml);
  }, []);

  useEffect(() => {
    localStorage.setItem('lastPrompt', prompt);
  }, [prompt]);
  
  useEffect(() => {
    if (html) localStorage.setItem('lastHtml', html);
  }, [html]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Введите описание сайта');
      return;
    }

    setLoading(true);
    setError('');
    setStatusMessages([]);
    setHtml('');

    try {
      const response = await fetch('http://localhost:3001/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'status') {
              setStatusMessages(prev => [...prev, data.message]);
            } else if (data.type === 'result') {
              setHtml(data.html);
              // Сохраняем в историю
              const newHistoryItem = {
                id: Date.now(),
                prompt: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''),
                fullPrompt: prompt,
                html: data.html,
                date: new Date().toLocaleString()
              };
              setHistory(prev => [newHistoryItem, ...prev].slice(0, 20));
              localStorage.setItem('designHistory', JSON.stringify([newHistoryItem, ...history].slice(0, 20)));
            } else if (data.type === 'error') {
              setError(data.message);
            }
          }
        }
      }
    } catch (err) {
      setError('Не удалось соединиться с сервером.');
    } finally {
      setLoading(false);
    }
  };

  const exportToReact = () => {
    if (!html) return;
    
    const componentCode = `import React from 'react';

const GeneratedSite = () => {
  return (
    <div dangerouslySetInnerHTML={{ __html: \`${html.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\` }} />
  );
};

export default GeneratedSite;`;

    const blob = new Blob([componentCode], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'GeneratedSite.jsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveApiKey = async () => {
    await fetch('http://localhost:3001/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, model })
    });
    alert('Настройки сохранены. Перезапустите сервер, чтобы изменения вступили в силу.');
  };

  return (
    <div className="app">
      <div className="chat-panel">
        <div className="chat-header">
          <h1>🎨 SiteGen</h1>
          <div className="subtitle">Генератор дизайна сайтов</div>
        </div>
        <div className="api-settings">
          <details>
            <summary>⚙️ Настройки API</summary>
            <div className="api-settings-content">
              <label>Ключ GigaChat:</label>
              <input 
                type="password" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Введите ключ API"
              />
              <button onClick={saveApiKey} className="save-api-btn">Сохранить</button>
              
              <label>Модель:</label>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="GigaChat-2-Max">Max (токены закончились)</option>
                <option value="GigaChat-2-Pro">Pro (45 524 токена)</option>
                <option value="GigaChat-2">Lite (891 776 токенов)</option>
              </select>
            </div>
          </details>
        </div>
        <div className="chat-messages">
          <div className="welcome-message">
            <p>👋 Опишите сайт, который хотите создать</p>
            <div className="example">📝 Например: «Лендинг для кофейни в скандинавском стиле, светлая тема»</div>
          </div>
          
          {/* Отображение статусов генерации */}
          {statusMessages.length > 0 && (
            <div className="status-list">
              {statusMessages.map((msg, idx) => (
                <div key={idx} className="status-item">
                  {msg.message || msg}
                </div>
              ))}
            </div>
          )}
          
          {/* Индикатор статуса генерации */}
          {loading && (
            <div className="status-container">
              <div className="status-spinner"></div>
              <div className="status-text">Генерация...</div>
            </div>
          )}
          
          {html && (
            <>
              <div className="success-message">✅ Сайт сгенерирован! Превью справа.</div>
              <button onClick={exportToReact} className="export-react-btn">
                📦 Экспорт в React
              </button>
            </>
          )}
          {error && <div className="error-message">❌ {error}</div>}
        </div>
        
        <div className="chat-messages">
        </div>
        {history.length > 0 && (
          <div className="history-area">
            <div className="history-header">
              <h3>📜 История генераций</h3>
              <button onClick={() => {
                setHistory([]);
                localStorage.removeItem('designHistory');
              }} className="clear-history-btn">Очистить</button>
            </div>
            <div className="history-list">
              {history.map(item => (
                <button key={item.id} className="history-item" onClick={() => {
                  setPrompt(item.fullPrompt);
                  setHtml(item.html);
                }}>
                  {item.prompt}
                  <span className="history-date">{item.date}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="chat-input-area">
          {/* существующий код textarea, button */}
        </div>

        <div className="chat-input-area">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Опишите дизайн сайта..."
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
          />
          <button onClick={handleGenerate} disabled={loading}>
            {loading ? '🔄 Генерация...' : '✨ Создать сайт'}
          </button>
        </div>
      </div>

      <div className="preview-panel">
        <div className="preview-header">
          <h2>📱 Превью сайта</h2>
        </div>
        <div className="preview-content">
          {html ? (
            <iframe
              srcDoc={html}
              title="site-preview"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              className="preview-iframe"
              style={{ overflow: 'hidden' }}
            />
          ) : (
            <div className="empty-preview">
              <div className="empty-icon">✨</div>
              <h3>Здесь будет ваш сайт</h3>
              <p>Опишите дизайн слева и нажмите «Создать сайт»</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;