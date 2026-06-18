import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import GigaChat from 'gigachat';
import { Agent } from 'node:https';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========== НАСТРОЙКИ ИСТОРИИ ==========
const HISTORY_FILE = path.join(__dirname, 'history.json');
const MAX_HISTORY = 100; // максимальное количество сохранённых записей

// Функция для загрузки истории из файла
function loadHistory() {
    if (fs.existsSync(HISTORY_FILE)) {
        try {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            console.error('❌ Ошибка загрузки истории:', e.message);
            return [];
        }
    }
    return [];
}

// Функция для сохранения истории в файл
function saveHistory(history) {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
    } catch (e) {
        console.error('❌ Ошибка сохранения истории:', e.message);
    }
}

// Читаем .env файл
const envPath = path.join(__dirname, '.env');
let AUTHORIZATION_KEY = '';

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/GIGACHAT_CREDENTIALS=(.+)/);
    if (match) {
        AUTHORIZATION_KEY = match[1].trim();
    }
}

if (!AUTHORIZATION_KEY) {
    console.error('❌ Ошибка: Не найден GIGACHAT_CREDENTIALS в .env файле');
    process.exit(1);
}

console.log('✅ Ключ API загружен из .env');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const sitesDir = path.join(__dirname, 'generated_sites');
if (!fs.existsSync(sitesDir)) {
    fs.mkdirSync(sitesDir);
    console.log('📁 Создана папка: generated_sites');
}
const httpsAgent = new Agent({ rejectUnauthorized: false });

// ========== ФУНКЦИЯ ДЛЯ ЗАГРУЗКИ ПРОМПТОВ ИЗ ФАЙЛОВ ==========
function loadPrompt(filename) {
    const filePath = path.join(__dirname, 'prompts', filename);
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return content;
    } catch (error) {
        console.error(`❌ Ошибка загрузки промпта ${filename}:`, error.message);
        return null;
    }
}

// ========== ФУНКЦИЯ ДЛЯ СОЗДАНИЯ КЛИЕНТА ==========
let currentModel = 'GigaChat-2-Pro';

function createGigaChatClient(model = currentModel) {
    console.log(`🔄 Создан клиент с моделью: ${model}`);
    return new GigaChat({
        credentials: AUTHORIZATION_KEY,
        timeout: 240,
        httpsAgent: httpsAgent,
        model: model,
        temperature: 1.3,
        // Добавляем обработку ошибок
        verbose: false
    });
}

// Создаём начальный клиент
let client = createGigaChatClient(currentModel);

// ========== ЭНДПОИНТ ДЛЯ НАСТРОЕК ==========
app.post('/api/settings', (req, res) => {
    const { apiKey, model } = req.body;
    
    if (apiKey && apiKey.trim() !== '') {
        process.env.GIGACHAT_CREDENTIALS = apiKey;
        AUTHORIZATION_KEY = apiKey;
    }
    
    if (model) {
        currentModel = model;
        // Пересоздаём клиент с новой моделью
        client = createGigaChatClient(model);
        console.log(`✅ Модель изменена на: ${model}`);
    }
    
    res.json({ 
        success: true, 
        message: `Настройки сохранены. Текущая модель: ${currentModel}` 
    });
});

// ========== ЭНДПОИНТ ДЛЯ ПОЛУЧЕНИЯ ИСТОРИИ ==========
app.get('/api/history', (req, res) => {
    try {
        const history = loadHistory();
        // Возвращаем только краткую информацию (без полного HTML для экономии)
        const briefHistory = history.map(item => ({
            id: item.id,
            prompt: item.prompt,
            date: item.date,
            model: item.model || 'unknown',
            edited: item.edited || false,
            type: item.type || 'landing'
        }));
        res.json({ success: true, history: briefHistory });
    } catch (error) {
        console.error('❌ Ошибка получения истории:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});  

// ========== ЭНДПОИНТ ДЛЯ УДАЛЕНИЯ ЗАПИСИ ИЗ ИСТОРИИ ==========
app.delete('/api/history/:fileId', (req, res) => {
    const { fileId } = req.params;
    const history = loadHistory();
    const index = history.findIndex(item => item.id === fileId);
    
    if (index === -1) {
        return res.status(404).json({ success: false, error: 'Запись не найдена' });
    }
    
    history.splice(index, 1);
    saveHistory(history);
    
    // Также удаляем файл, если он есть
    const filePath = path.join(__dirname, 'generated_sites', `${fileId}.html`);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    
    res.json({ success: true, message: 'Запись удалена' });
});

// ========== ЭНДПОИНТ ДЛЯ ПОЛУЧЕНИЯ СОХРАНЁННОГО САЙТА ==========
app.get('/api/site/:fileId', (req, res) => {
    const { fileId } = req.params;
    const filePath = path.join(__dirname, 'generated_sites', `${fileId}.html`);
    
    if (fs.existsSync(filePath)) {
        const html = fs.readFileSync(filePath, 'utf8');
        res.json({ success: true, html });
    } else {
        res.status(404).json({ success: false, error: 'Сайт не найден' });
    }
});

// ========== ЗАГРУЗКА ПРОМПТОВ ==========
const classifierPrompt = loadPrompt('classifier.txt');
const systemPromptLanding = loadPrompt('landing.txt');
const systemPromptMultiPage = loadPrompt('multipage.txt');

if (!classifierPrompt || !systemPromptLanding || !systemPromptMultiPage) {
    console.error('❌ Ошибка загрузки промптов');
    process.exit(1);
}
console.log('✅ Все промпты загружены');

// ========== ОСНОВНОЙ ЭНДПОИНТ ГЕНЕРАЦИИ (ДВУХФАЗНЫЙ) ==========
app.post('/api/generate', async (req, res) => {
    const startTime = Date.now();
    const { prompt } = req.body;
    
    if (!prompt || prompt.trim() === '') {
        return res.status(400).json({ success: false, error: 'Введите описание сайта' });
    }
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const sendStatus = (msg) => {
        console.log(`  📢 ${msg}`);
        res.write(`data: ${JSON.stringify({ type: 'status', message: msg })}\n\n`);
    };
    
    console.log('\n' + '='.repeat(60));
    console.log(`📝 ЗАПРОС: ${prompt}`);
    console.log('='.repeat(60));
    
    try {
        // ========== ФАЗА 1: ОПРЕДЕЛЕНИЕ ТИПА САЙТА ==========
        sendStatus('🔍 Определение типа сайта...');
        
        const classifierRequest = classifierPrompt.replace('USER_PROMPT', prompt);
        const classifierResponse = await client.chat({
            messages: [
                { role: "user", content: classifierRequest }
            ],
            temperature: 0.1
        });
        
        let siteType = classifierResponse.choices[0]?.message.content?.trim().toLowerCase() || 'landing';
        
        // Нормализуем ответ
        if (siteType.includes('landing')) siteType = 'landing';
        else if (siteType.includes('multipage') || siteType.includes('multi')) siteType = 'multipage';
        else siteType = 'landing';
        
        console.log(`  📌 Определён тип: ${siteType}`);
        sendStatus(`🎯 Тип сайта: ${siteType === 'landing' ? '🌐 Лендинг' : '📊 Многостраничный / Дашборд'}`);
        
        // ========== ФАЗА 2: ГЕНЕРАЦИЯ САЙТА ==========
        const selectedPrompt = siteType === 'landing' ? systemPromptLanding : systemPromptMultiPage;
        
        sendStatus(`📄 Создание ${siteType === 'landing' ? 'лендинга' : 'многостраничного сайта'} (модель: ${currentModel})...`);
        
        const response = await client.chat({
            messages: [
                { role: "system", content: selectedPrompt },
                { role: "user", content: prompt }
            ],
        });
        
        let html = response.choices[0]?.message.content || '';
        sendStatus(`✅ HTML создан (${html.length} символов)`);
        
        // Чистка
        html = html.replace(/```html\n?/gi, '').replace(/```\n?/gi, '');
        const htmlEndIndex = html.toLowerCase().lastIndexOf('</html>');
        if (htmlEndIndex !== -1) html = html.substring(0, htmlEndIndex + 7);
        
        // Аватары
        html = html.replace(/<img[^>]+class="avatar"[^>]*>/gi, () => {
            const gender = Math.random() > 0.5 ? 'women' : 'men';
            const num = Math.floor(Math.random() * 90) + 1;
            return `<img src="https://randomuser.me/api/portraits/${gender}/${num}.jpg" style="width:64px; height:64px; border-radius:50%; object-fit:cover;">`;
        });
        
        // Скрипты
        const scripts = `
<script>
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        const target = document.querySelector(targetId);
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.card, section, .review-card').forEach(el => {
    el.classList.add('fade-wait');
    observer.observe(el);
});
</script>
<style>
.fade-wait { opacity: 0; transform: translateY(30px); transition: all 0.6s ease-out; }
.fade-wait.visible { opacity: 1; transform: translateY(0); }
.card, .review-card { transition: all 0.3s ease; }
.card:hover, .review-card:hover { transform: translateY(-8px) scale(1.02); box-shadow: 0 20px 30px -10px rgba(0,0,0,0.2); }
html { scroll-behavior: smooth; scroll-padding-top: 80px; }
</style>`;
        
        html = html.replace('</body>', scripts + '\n</body>');
        
        // ========== СОХРАНЕНИЕ ==========
        const fileId = uuidv4();
        const fileName = `${fileId}.html`;
        const filePath = path.join(__dirname, 'generated_sites', fileName);
        fs.writeFileSync(filePath, html, 'utf8');
        
        const history = loadHistory();
        history.unshift({
            id: fileId,
            prompt: prompt,
            html: html,
            date: new Date().toISOString(),
            model: currentModel,
            type: siteType
        });
        if (history.length > MAX_HISTORY) {
            history.length = MAX_HISTORY;
        }
        saveHistory(history);
        console.log(`💾 История сохранена (всего записей: ${history.length})`);
        
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        sendStatus(`✨ Готово! Сайт создан за ${totalTime} секунд`);
        console.log(`✅ ГОТОВО за ${totalTime} сек\n`);
        
        res.write(`data: ${JSON.stringify({ type: 'result', html: html, fileId: fileId, siteType: siteType })}\n\n`);
        res.end();
        
    } catch (error) {
        console.error(`❌ ОШИБКА:`, error);
        
        let userMessage = '❌ Проверьте, введён ли ключ API и какой у вас баланс токенов.';
        
        if (error.message) {
            const msg = error.message.toLowerCase();
            if (msg.includes('401') || msg.includes('unauthorized')) {
                userMessage = '❌ Неверный ключ API. Проверьте настройки.';
            } else if (msg.includes('429') || msg.includes('quota') || msg.includes('limit') || msg.includes('токен')) {
                userMessage = '⚠️ Закончились токены. Смените модель на Lite.';
            } else if (msg.includes('timeout')) {
                userMessage = '⏱️ Превышено время ожидания.';
            } else if (msg.includes('object') || msg.includes('[object')) {
                userMessage = '❌ Проверьте, введён ли ключ API и какой у вас баланс токенов.';
            } else {
                userMessage = `❌ Ошибка: ${error.message}`;
            }
        }
        
        res.write(`data: ${JSON.stringify({ type: 'error', message: userMessage })}\n\n`);
        res.end();
    }
});

// ========== ЭНДПОИНТ ДЛЯ РЕДАКТИРОВАНИЯ ==========
app.post('/api/edit', async (req, res) => {
    const startTime = Date.now();
    const { prompt, currentHtml } = req.body;
    
    if (!prompt || prompt.trim() === '') {
        return res.status(400).json({ success: false, error: 'Введите описание изменений' });
    }
    
    if (!currentHtml || currentHtml.trim() === '') {
        return res.status(400).json({ success: false, error: 'Нет текущего сайта для редактирования' });
    }
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const sendStatus = (msg) => {
        console.log(`  📢 ${msg}`);
        res.write(`data: ${JSON.stringify({ type: 'status', message: msg })}\n\n`);
    };
    
    console.log('\n' + '='.repeat(60));
    console.log(`📝 РЕДАКТИРОВАНИЕ: ${prompt}`);
    console.log('='.repeat(60));
    
    try {
        sendStatus('🔍 Анализ запроса на изменения...');
        
        const editPrompt = `Ты — ведущий веб-дизайнер. Вот текущий HTML код сайта:

${currentHtml}

Запрос пользователя на изменения: ${prompt}

Пожалуйста, модифицируй HTML код в соответствии с запросом. Сохрани всю структуру и стили, которые не противоречат запросу. Верни ТОЛЬКО полный HTML код (начиная с <!DOCTYPE html> и заканчивая </html>). Не добавляй никаких пояснений вне кода.`;

        sendStatus(`🔄 Генерация обновлённой версии (модель: ${currentModel})...`);
        const response = await client.chat({
            messages: [
                { role: "system", content: "Ты — эксперт по HTML/CSS. Твоя задача — изменять существующий код по запросу пользователя. Сохраняй все стили и структуру, которые не противоречат запросу. Возвращай ТОЛЬКО полный HTML код." },
                { role: "user", content: editPrompt }
            ],
        });
        
        let html = response.choices[0]?.message.content || '';
        sendStatus(`✅ Обновлённый HTML создан (${html.length} символов)`);
        
        html = html.replace(/```html\n?/gi, '').replace(/```\n?/gi, '');
        const htmlEndIndex = html.toLowerCase().lastIndexOf('</html>');
        if (htmlEndIndex !== -1) html = html.substring(0, htmlEndIndex + 7);
        
        if (!html.includes('fade-wait')) {
            const scripts = `
<script>
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        const target = document.querySelector(targetId);
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.card, section, .review-card').forEach(el => {
    el.classList.add('fade-wait');
    observer.observe(el);
});
</script>
<style>
.fade-wait { opacity: 0; transform: translateY(30px); transition: all 0.6s ease-out; }
.fade-wait.visible { opacity: 1; transform: translateY(0); }
.card, .review-card { transition: all 0.3s ease; }
.card:hover, .review-card:hover { transform: translateY(-8px) scale(1.02); box-shadow: 0 20px 30px -10px rgba(0,0,0,0.2); }
html { scroll-behavior: smooth; scroll-padding-top: 80px; }
</style>`;
            
            html = html.replace('</body>', scripts + '\n</body>');
        }
        
        const fileId = uuidv4();
        const fileName = `${fileId}.html`;
        const filePath = path.join(__dirname, 'generated_sites', fileName);
        
        if (!fs.existsSync(path.join(__dirname, 'generated_sites'))) {
            fs.mkdirSync(path.join(__dirname, 'generated_sites'));
        }
        
        fs.writeFileSync(filePath, html, 'utf8');
        
        // ========== СОХРАНЕНИЕ В ИСТОРИЮ (РЕДАКТИРОВАНИЕ) ==========
        const history = loadHistory();
        // Добавляем запись с пометкой "edited"
        history.unshift({
            id: fileId,
            prompt: `[Редактирование] ${prompt}`,
            html: html,
            date: new Date().toISOString(),
            model: currentModel,
            edited: true
        });
        if (history.length > MAX_HISTORY) {
            history.length = MAX_HISTORY;
        }
        saveHistory(history);
        console.log(`💾 История сохранена после редактирования (всего записей: ${history.length})`);

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        sendStatus(`✨ Готово! Сайт обновлён за ${totalTime} секунд`);
        console.log(`✅ ОБНОВЛЕНО за ${totalTime} сек\n`);
        
        res.write(`data: ${JSON.stringify({ type: 'result', html: html, fileId: fileId })}\n\n`);
        res.end();
        
    } catch (error) {
        console.error(`❌ ОШИБКА:`, error);
        
        let userMessage = '❌ Проверьте, введён ли ключ API и какой у вас баланс токенов.';
        
        if (error.message) {
            const msg = error.message.toLowerCase();
            if (msg.includes('401') || msg.includes('unauthorized')) {
                userMessage = '❌ Неверный ключ API. Проверьте настройки.';
            } else if (msg.includes('429') || msg.includes('quota') || msg.includes('limit') || msg.includes('токен')) {
                userMessage = '⚠️ Закончились токены. Смените модель на Lite.';
            } else if (msg.includes('timeout')) {
                userMessage = '⏱️ Превышено время ожидания.';
            } else if (msg.includes('object') || msg.includes('[object')) {
                userMessage = '❌ Проверьте, введён ли ключ API и какой у вас баланс токенов.';
            } else {
                userMessage = `❌ Ошибка: ${error.message}`;
            }
        } else if (typeof error === 'string') {
            userMessage = `❌ Ошибка: ${error}`;
        }
        
        res.write(`data: ${JSON.stringify({ type: 'error', message: userMessage })}\n\n`);
        res.end();
    }
});

app.listen(3001, () => {
    console.log('\n🚀 СЕРВЕР: http://localhost:3001');
    console.log(`🤖 Текущая модель: ${currentModel}`);
    console.log('💡 Для смены модели используйте настройки API в интерфейсе\n');
});