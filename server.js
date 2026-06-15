import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import GigaChat from 'gigachat';
import { Agent } from 'node:https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Читаем .env файл вручную
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
    console.error('📁 Создай файл .env в папке:', __dirname);
    console.error('📝 Добавь строку: GIGACHAT_CREDENTIALS=твой_ключ');
    process.exit(1);
}

console.log('✅ Ключ API загружен из .env');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const httpsAgent = new Agent({ rejectUnauthorized: false });

const client = new GigaChat({
    credentials: AUTHORIZATION_KEY,
    timeout: 240,
    httpsAgent: httpsAgent,
    model: 'GigaChat-2-Pro',
    temperature: 1.3
});

// ========== БОЛЬШОЙ СИСТЕМНЫЙ ПРОМПТ (без картинок) ==========
const systemPrompt = `Ты — ведущий веб-дизайнер с 10-летним опытом, специализирующийся на создании безупречных пользовательских интерфейсов. Твоя задача — проанализировать запрос пользователя и создать современный, полностью рабочий HTML/CSS сайт, который идеально соответствует тематике и требованиям.

## 🎯 АНАЛИЗ И АДАПТАЦИЯ (КЛЮЧЕВОЕ ПРАВИЛО):
Перед созданием кода ты ДОЛЖЕН определить тип проекта и применить соответствующую стилистику:

1. **Бизнес/Корпоративный** (IT, услуги, консалтинг): строгий, минималистичный, синий/серый/тёмный, много пространства, акцент на типографику и сетку.
2. **Креативный/Портфолио** (дизайнеры, фотографы, студии): смелые цвета (неон, пастель), нестандартные макеты, большие изображения, креативные шрифты.
3. **E-commerce/Магазин** (продукты, товары): акцент на карточки товаров, кнопки "Купить", корзина, белый фон, выделенные CTA.
4. **Гостеприимство/Рестораны** (кафе, отели, бары): тёплая палитра (коричневый, бежевый, оливковый), изящные шрифты, атмосферные изображения, акцент на еду/напитки.
5. **Образовательный** (курсы, школы): чистый, дружелюбный, игривые акценты, чёткая иерархия, блоки с преимуществами.
6. **Технологичный/Стартап**: футуристические градиенты, тёмная тема, глитч-эффекты, современные шрифты (Space Grotesk, Clash Display).

## 🎨 УНИВЕРСАЛЬНЫЕ ДИЗАЙН-ПРИНЦИПЫ (ОБЯЗАТЕЛЬНО):
1. **Цветовая схема**: Подбирай гармоничную палитру (темную, светлую, пастельную, контрастную) строго на основе запроса пользователя. НЕ используй белую тему по умолчанию.
2. **Шрифты**: 'Inter', 'Poppins', 'Montserrat', 'Playfair Display', 'Space Grotesk', 'DM Sans'
3. **Визуальный ритм**: Чередуй фон между блоками (светлый/темный, градиент/плоский)
4. **Стилизация**: Скругленные углы (20-28px), тени, градиенты
5. **Типографика**: h1: clamp(40px, 8vw, 80px), h2: clamp(32px, 6vw, 48px)

## 🌈 ДИНАМИЧЕСКИЙ ФОН (ОБЯЗАТЕЛЬНО):
- Фон страницы НЕ должен быть одноцветным!
- Используй градиент, который плавно переходит из одного цвета в другой
- Добавь анимацию фона (медленное движение градиента или плавное изменение цветов)
- Пример градиента с анимацией:
  body {
    background: linear-gradient(135deg, #667eea, #764ba2, #f093fb, #f5576c);
    background-size: 400% 400%;
    animation: gradientBG 15s ease infinite;
  }
  @keyframes gradientBG {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
- Цвета градиента подбирай в зависимости от тематики сайта
- ВАЖНО: Чтобы текст оставался читаемым, все блоки с текстом (карточки, секции) должны иметь светлый или полупрозрачный фон с достаточным контрастом (например, rgba(255,255,255,0.9) для светлой темы или rgba(0,0,0,0.7) для тёмной)
- Добавь эффект "стекла" (glassmorphism) для карточек: backdrop-filter: blur(10px); background: rgba(255,255,255,0.8);

## 🔧 КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ:
1. **КНОПКИ**: z-index min 10, header z-index 100, все кнопки кликабельны и видны
2. **КОНТРАСТ ТЕКСТА**: WCAG минимум 4.5:1, тёмный текст на светлом фоне, светлый на тёмном
3. **РАССТОЯНИЕ МЕЖДУ КНОПКАМИ**: display: flex; gap: 16-24px
4. **ОБЪЁМНЫЙ ТЕКСТ**: Пиши РАЗВЁРНУТЫЕ описания! Каждая карточка должна содержать 3-4 предложения с конкретными деталями, цифрами, преимуществами. Отзывы — 2-3 полноценных предложения. НЕ используй короткие фразы-заглушки!

## 🖼️ КАРТИНКИ (СТРОГОЕ ПРАВИЛО):
- НЕ используй никакие внешние изображения (no picsum.photos, no unsplash, no local files)
- Для карточек используй ТОЛЬКО цветные градиентные блоки с эмодзи:
  <div style="background: linear-gradient(135deg, #667eea, #764ba2); width:100%; height:200px; display:flex; align-items:center; justify-content:center; border-radius:20px; margin-bottom:16px;">
      <span style="font-size:56px;">🎨</span>
  </div>
- Для аватарок используй randomuser.me: <img src="https://randomuser.me/api/portraits/women/1.jpg" style="width:64px; height:64px; border-radius:50%; object-fit:cover;">

## 🔘 КОМПОНЕНТЫ:
1. **Кнопки**: padding: 14px 32px, border-radius: 40px, gradient background, hover: translateY(-2px)
2. **Кнопка со стрелкой**: flex + gap, при hover стрелка двигается
3. **Навигация**: sticky, backdrop-filter: blur(10px), плавный скролл
4. **Анимированная стрелка вниз**: bounce анимация в hero-секции

## ✨ АНИМАЦИИ:
- Intersection Observer для появления при скролле
- Классы: .fade-up, .fade-left, .fade-right
- При наведении на карточку: scale(1.02), тень
- Анимация градиента фона (медленное движение)

## 📐 СТРУКТУРА САЙТА:
1. **Header**: лого + навигация (бургер на мобильных), с полупрозрачным фоном (backdrop-filter: blur(10px))
2. **Hero**: заголовок, описание, 2 кнопки, стрелка вниз
3. **Секция карточек**: грид 3-4 колонки (каждая с градиентным блоком + эмодзи, заголовком и РАЗВЁРНУТЫМ описанием 3-4 предложения)
4. **Секция отзывов**: грид с аватарами, именами, звёздами и ПОЛНЫМИ отзывами (2-3 предложения)
5. **Секция CTA**: призыв + форма email
6. **Footer**: навигация, соцсети, копирайт

## 📱 АДАПТИВНОСТЬ:
- Медиа-запросы: 768px, 1024px
- На мобильных: padding: 16px, грид 1 колонка

## 🎯 ИКОНКИ (эмодзи для градиентных блоков):
🎨 📸 ☕ 🍔 💻 🚀 ⚡ 🔥 🎮 🎵 📚 🏆 💡 🌟 🎯

## 📤 ФОРМАТ ВЫВОДА:
- Верни ТОЛЬКО HTML код
- Начинай с <!DOCTYPE html>
- Все стили внутри <style>, JS внутри <script>
- НИКАКИХ пояснений после </html>

Проверь: читаемость текста, кликабельность кнопок, адаптивность, ОБЪЁМНЫЙ ТЕКСТ в карточках и отзывах, АНИМИРОВАННЫЙ ГРАДИЕНТ ФОНА.`;

app.post('/api/settings', (req, res) => {
  const { apiKey, model } = req.body;
  if (apiKey && apiKey.trim() !== '') {
    process.env.GIGACHAT_CREDENTIALS = apiKey;
  }
  if (model) {
    process.env.GIGA_MODEL = model;
  }
  res.json({ success: true, message: 'Настройки сохранены. Перезапустите сервер.' });
});

// ========== ОСНОВНОЙ ЭНДПОИНТ (с SSE для статусов) ==========
app.post('/api/generate', async (req, res) => {
    const startTime = Date.now();
    const { prompt } = req.body;
    
    if (!prompt || prompt.trim() === '') {
        return res.status(400).json({ success: false, error: 'Введите описание сайта' });
    }
    
    // Устанавливаем заголовки для SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Функция отправки статуса в реальном времени
    const sendStatus = (msg) => {
        console.log(`  📢 ${msg}`);
        res.write(`data: ${JSON.stringify({ type: 'status', message: msg })}\n\n`);
    };
    
    console.log('\n' + '='.repeat(60));
    console.log(`📝 ЗАПРОС: ${prompt}`);
    console.log('='.repeat(60));
    
    try {
        sendStatus('🔍 Анализ темы запроса...');
        
        // Определяем тему для цветовой схемы
        let theme = 'абстракция';
        if (prompt.toLowerCase().includes('кофейн')) theme = 'кофе';
        else if (prompt.toLowerCase().includes('игр')) theme = 'игры';
        else if (prompt.toLowerCase().includes('фотограф')) theme = 'фотография';
        else if (prompt.toLowerCase().includes('it')) theme = 'технологии';
        else if (prompt.toLowerCase().includes('бизнес')) theme = 'бизнес';
        sendStatus(`🎯 Определена тема: ${theme}`);
        
        // Получаем модель из настроек (если установлена)
        const modelFromSettings = process.env.GIGA_MODEL || 'GigaChat-2-Pro';
        
        // Если нужно обновить модель в клиенте (пересоздаём клиент с новой моделью)
        let currentClient = client;
        if (modelFromSettings !== client.options.model) {
            console.log(`  🔄 Смена модели на: ${modelFromSettings}`);
            currentClient = new GigaChat({
                credentials: AUTHORIZATION_KEY,
                timeout: 240,
                httpsAgent: httpsAgent,
                model: modelFromSettings,
                temperature: 1.3
            });
        }
        
        // Генерируем HTML
        sendStatus('📄 Создание HTML вёрстки...');
        const response = await currentClient.chat({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
        });
        
        let html = response.choices[0]?.message.content || '';
        sendStatus(`✅ HTML создан (${html.length} символов)`);
        
        // Чистка от markdown
        html = html.replace(/```html\n?/gi, '').replace(/```\n?/gi, '');
        const htmlEndIndex = html.toLowerCase().lastIndexOf('</html>');
        if (htmlEndIndex !== -1) html = html.substring(0, htmlEndIndex + 7);
        
        // Аватары из randomuser.me
        html = html.replace(/<img[^>]+class="avatar"[^>]*>/gi, () => {
            const gender = Math.random() > 0.5 ? 'women' : 'men';
            const num = Math.floor(Math.random() * 90) + 1;
            return `<img src="https://randomuser.me/api/portraits/${gender}/${num}.jpg" style="width:64px; height:64px; border-radius:50%; object-fit:cover;">`;
        });
        
        // Скрипты для анимаций
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
        
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        sendStatus(`✨ Готово! Сайт создан за ${totalTime} секунд`);
        console.log(`✅ ГОТОВО за ${totalTime} сек\n`);
        
        // Отправляем финальный результат
        res.write(`data: ${JSON.stringify({ type: 'result', html: html })}\n\n`);
        res.end();
        
    } catch (error) {
        console.error(`❌ ОШИБКА:`, error.message);
        
        let userMessage = error.message;
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            userMessage = '❌ Неверный ключ API. Проверьте настройки в разделе ⚙️ Настройки API.';
        } else if (error.message.includes('429') || error.message.includes('quota')) {
            userMessage = '⚠️ Закончились токены для выбранной модели. Смените модель в настройках на Lite или Pro.';
        } else if (error.message.includes('timeout')) {
            userMessage = '⏱️ Превышено время ожидания. Попробуйте упростить запрос или повторите позже.';
        } else {
            userMessage = `❌ Ошибка: ${error.message}`;
        }
        
        res.write(`data: ${JSON.stringify({ type: 'error', message: userMessage })}\n\n`);
        res.end();
    }
});

app.listen(3001, () => {
    console.log('\n🚀 СЕРВЕР: http://localhost:3001');
    console.log('🤖 Генерация сайтов через GigaChat-2-Pro');
    console.log('🎨 Смайлики и градиенты вместо картинок\n');
});