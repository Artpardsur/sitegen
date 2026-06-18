import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [prompt, setPrompt] = useState('');
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessages, setStatusMessages] = useState([]);
  const [statusHistory, setStatusHistory] = useState([]);
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('designHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('GigaChat-2-Pro');
  const [isEditing, setIsEditing] = useState(false);
  const [currentFileId, setCurrentFileId] = useState(null);
  const textareaRef = useRef(null);

  // ========== СОСТОЯНИЯ ДЛЯ РАЗМЕРОВ ==========
  const [historyWidth, setHistoryWidth] = useState(() => {
    const saved = localStorage.getItem('historyWidth');
    return saved ? parseInt(saved) : 280;
  });
  const [chatWidth, setChatWidth] = useState(() => {
    const saved = localStorage.getItem('chatWidth');
    return saved ? parseInt(saved) : 400;
  });
  
  // ========== ПЕРЕТАСКИВАНИЕ ==========
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState(null); // 'history' или 'chat'
  const [startX, setStartX] = useState(0);
  const [startHistoryWidth, setStartHistoryWidth] = useState(0);
  const [startChatWidth, setStartChatWidth] = useState(0);

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

  // ========== ОБРАБОТЧИКИ ПЕРЕТАСКИВАНИЯ ==========
  const startDrag = (e, type) => {
    e.preventDefault();
    setIsDragging(true);
    setDragType(type);
    setStartX(e.clientX);
    setStartHistoryWidth(historyWidth);
    setStartChatWidth(chatWidth);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const onDrag = (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    
    if (dragType === 'history') {
      const newWidth = Math.max(150, Math.min(500, startHistoryWidth + deltaX));
      setHistoryWidth(newWidth);
      localStorage.setItem('historyWidth', newWidth);
    } else if (dragType === 'chat') {
      const newWidth = Math.max(250, Math.min(700, startChatWidth + deltaX));
      setChatWidth(newWidth);
      localStorage.setItem('chatWidth', newWidth);
    }
  };

  const stopDrag = () => {
    setIsDragging(false);
    setDragType(null);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onDrag);
      window.addEventListener('mouseup', stopDrag);
    } else {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', stopDrag);
    }
    return () => {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', stopDrag);
    };
  }, [isDragging]);

  const handleGenerate = async () => {
    // ... ваш существующий код handleGenerate ...
    if (!prompt.trim()) {
      setError('Введите описание сайта');
      return;
    }

    setLoading(true);
    setError('');
    setStatusMessages([]);
    setStatusHistory([]);
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
                setStatusHistory(prev => [...prev, data.message]);
            } else if (data.type === 'result') {
              setHtml(data.html);
              setCurrentFileId(data.fileId);
              const newHistoryItem = {
                id: Date.now(),
                prompt: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''),
                fullPrompt: prompt,
                html: data.html,
                fileId: data.fileId,
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

  const handleEdit = async () => {
    // ... ваш существующий код handleEdit ...
    if (!prompt.trim()) {
      setError('Опишите, что хотите изменить');
      return;
    }

    if (!html) {
      setError('Нет сайта для редактирования');
      return;
    }

    setLoading(true);
    setError('');
    setStatusMessages([]);
    setStatusHistory([]);
    setIsEditing(true);

    try {
      const response = await fetch('http://localhost:3001/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: prompt,
          currentHtml: html 
        }),
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
                setStatusHistory(prev => [...prev, data.message]);
            } else if (data.type === 'result') {
              setHtml(data.html);
              setCurrentFileId(data.fileId);
              const newHistoryItem = {
                id: Date.now(),
                prompt: `✏️ ${prompt.slice(0, 40)}...`,
                fullPrompt: prompt,
                html: data.html,
                fileId: data.fileId,
                date: new Date().toLocaleString()
              };
              setHistory(prev => [newHistoryItem, ...prev].slice(0, 20));
              localStorage.setItem('designHistory', JSON.stringify([newHistoryItem, ...history].slice(0, 20)));
              setIsEditing(false);
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
    // ... ваш существующий код exportToReact ...
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

  const loadSiteFromHistory = async (item) => {
    // ... ваш существующий код loadSiteFromHistory ...
    if (item.html) {
      setHtml(item.html);
      setPrompt(item.fullPrompt || item.prompt);
      setCurrentFileId(item.fileId);
      setIsEditing(false);
      return;
    }
    
    if (item.fileId) {
      try {
        const response = await fetch(`http://localhost:3001/api/site/${item.fileId}`);
        const data = await response.json();
        if (data.success) {
          setHtml(data.html);
          setPrompt(item.fullPrompt || item.prompt);
          setCurrentFileId(item.fileId);
          setIsEditing(false);
        } else {
          setError('Не удалось загрузить сохранённый сайт');
        }
      } catch (err) {
        setError('Ошибка загрузки сайта');
      }
    }
  };

  const openInNewWindow = () => {
    // ... ваш существующий код openInNewWindow ...
    if (!html) return;
    
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Сгенерированный сайт</title>
</head>
<body>
  ${html}
</body>
</html>`;
    
    const newWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
    if (newWindow) {
      newWindow.document.write(fullHtml);
      newWindow.document.close();
    } else {
      setError('Пожалуйста, разрешите всплывающие окна для этого сайта');
    }
  };

  const saveApiKey = async () => {
    // ... ваш существующий код saveApiKey ...
    await fetch('http://localhost:3001/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, model })
    });
    alert('Настройки сохранены. Перезапустите сервер, чтобы изменения вступили в силу.');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (html && !isEditing) {
        handleEdit();
      } else {
        handleGenerate();
      }
    }
  };

  return (
    <div className="app" onMouseUp={stopDrag}>
      {/* ЛЕВАЯ ПАНЕЛЬ — ИСТОРИЯ */}
      <div className="history-panel" style={{ width: historyWidth }}>
        <div className="history-panel-header">
          <h3>История</h3>
          {history.length > 0 && (
            <button onClick={() => {
              setHistory([]);
              localStorage.removeItem('designHistory');
            }} className="clear-history-btn">Очистить</button>
          )}
        </div>
        <div className="history-panel-list">
          {history.length === 0 ? (
            <div className="history-empty">Пока нет генераций</div>
          ) : (
            history.map(item => (
              <button key={item.id} className="history-panel-item" onClick={() => loadSiteFromHistory(item)}>
                <div className="history-panel-item-prompt">{item.prompt}</div>
                <div className="history-panel-item-date">{item.date}</div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* РАЗДЕЛИТЕЛЬ 1 - МЕЖДУ ИСТОРИЕЙ И ЧАТОМ */}
      <div 
        className="resize-handle resize-handle-history"
        onMouseDown={(e) => startDrag(e, 'history')}
        title="Перетащите для изменения ширины истории"
      >
        <div className="resize-handle-line"></div>
      </div>

      {/* ЦЕНТРАЛЬНАЯ ПАНЕЛЬ — ЧАТ */}
      <div className="chat-panel" style={{ width: chatWidth }}>
        <div className="chat-header">
          <h1>SiteGen</h1>
          <div className="subtitle">Генератор дизайна сайтов</div>
        </div>
        
        <div className="api-settings">
          <details>
            <summary>Настройки API</summary>
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
                <option value="GigaChat-2-Max">Max</option>
                <option value="GigaChat-2-Pro">Pro</option>
                <option value="GigaChat-2">Lite</option>
              </select>
            </div>
          </details>
        </div>
        
        <div className="chat-messages">
          <div className="welcome-message">
            <p>{html ? '✏️ Режим редактирования' : 'Опишите сайт, который хотите создать'}</p>
            <div className="example">
              {html 
                ? 'Например: «сделай фон тёмным» или «добавь секцию с ценами»' 
                : 'Например: «Лендинг для кофейни в скандинавском стиле, светлая тема»'}
            </div>
          </div>

          {statusHistory.length > 0 && (
              <div className="status-history">
                  {statusHistory.map((msg, idx) => (
                      <div key={idx} className="status-history-item">
                          <span className="status-dot">●</span>
                          {msg}
                      </div>
                  ))}
              </div>
          )}
          
          {loading && (
            <div className="status-container">
              <div className="status-spinner"></div>
              <div className="status-text">{isEditing ? 'Редактирование...' : 'Генерация...'}</div>
            </div>
          )}
          
          {html && !loading && (
            <>
              <div className="success-message">✅ Сайт готов! {isEditing ? 'Изменения применены' : 'Превью справа'}</div>
              <button onClick={exportToReact} className="export-react-btn">
                Экспорт в React
              </button>
              <button onClick={openInNewWindow} className="open-new-window-btn">
                Открыть в новом окне
              </button>
            </>
          )}
          {error && <div className="error-message">❌ {error}</div>}
        </div>
        
        <div className="chat-input-area">
          <div className="input-header">
            <span className="mode-label">
              {html && !loading ? 'Редактирование' : 'Создание'}
            </span>
            {html && !loading && (
              <button 
                onClick={() => {
                  setHtml('');
                  setCurrentFileId(null);
                  setIsEditing(false);
                  setPrompt('');
                  setStatusMessages([]);
                  setError('');
                }} 
                className="clear-site-btn"
              >
                ✕
              </button>
            )}
          </div>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={html ? "Опишите изменения..." : "Опишите дизайн сайта..."}
            rows={3}
            onKeyDown={handleKeyDown}
          />
          <button 
            onClick={html ? handleEdit : handleGenerate} 
            disabled={loading}
            className={html ? 'edit-btn' : 'generate-btn'}
          >
            {loading ? '🔄 Обработка...' : html ? '✏️ Применить изменения' : '✨ Создать сайт'}
          </button>
        </div>
      </div>

      {/* РАЗДЕЛИТЕЛЬ 2 - МЕЖДУ ЧАТОМ И ПРЕВЬЮ */}
      <div 
        className="resize-handle resize-handle-chat"
        onMouseDown={(e) => startDrag(e, 'chat')}
        title="Перетащите для изменения ширины чата"
      >
        <div className="resize-handle-line"></div>
      </div>

      {/* ПРАВАЯ ПАНЕЛЬ — ПРЕВЬЮ */}
      <div className="preview-panel">
        <div className="preview-header">
          <h2>Превью сайта</h2>
          {html && (
            <span className="preview-badge">
              {currentFileId ? '💾 Сохранён' : '🆕 Новый'}
            </span>
          )}
        </div>
        <div className="preview-content">
          {html ? (
            <iframe
              srcDoc={html}
              title="site-preview"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              className="preview-iframe"
            />
          ) : (
            <div className="empty-preview">
              <div className="empty-icon">✨</div>
              <h3>Здесь будет ваш сайт</h3>
              <p>Опишите дизайн в центре и нажмите «Создать сайт»</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;