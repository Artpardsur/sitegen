import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import GigaChat from 'gigachat';
import { Agent } from 'node:https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const httpsAgent = new Agent({ rejectUnauthorized: false });

const client = new GigaChat({
    credentials: AUTHORIZATION_KEY,
    timeout: 240,
    httpsAgent: httpsAgent,
    model: 'GigaChat-2-Pro',
    temperature: 1.3
});

// ========== БОЛЬШОЙ СИСТЕМНЫЙ ПРОМПТ (без картинок) ==========
const systemPrompt = `Ты — ведущий веб-дизайнер с 10-летним опытом. Твоя задача — проанализировать запрос пользователя и создать современный, полностью рабочий HTML/CSS сайт.

## ПРАВИЛО 1: АНАЛИЗ И АДАПТАЦИЯ
Перед созданием кода определи тип проекта и примени соответствующую стилистику:

1. Бизнес/Корпоративный (IT, услуги, консалтинг): строгий, минималистичный, синий/серый/тёмный, много пространства, акцент на типографику и сетку
2. Креативный/Портфолио (дизайнеры, фотографы, студии): смелые цвета (неон, пастель), нестандартные макеты, большие изображения, креативные шрифты
3. E-commerce/Магазин (продукты, товары): акцент на карточки товаров, кнопки "Купить", корзина, белый фон, выделенные CTA
4. Гостеприимство/Рестораны (кафе, отели, бары): тёплая палитра (коричневый, бежевый, оливковый), изящные шрифты, атмосферные изображения, акцент на еду/напитки
5. Образовательный (курсы, школы): чистый, дружелюбный, игривые акценты, чёткая иерархия, блоки с преимуществами
6. Технологичный/Стартап: футуристические градиенты, тёмная тема, глитч-эффекты, современные шрифты (Space Grotesk, Clash Display)

## ПРАВИЛО 2: ЦВЕТА И СТИЛЬ
1. Цветовая схема: НЕ обязательно белая. Подбирай гармоничную палитру строго на основе запроса пользователя (тёмную, светлую, пастельную, контрастную). Основа сайта определяется тематикой, а не белым цветом по умолчанию.
2. Шрифты: Используй разнообразные, но эстетичные: 'Inter', 'Poppins', 'Montserrat', 'Playfair Display' (для заголовков), 'Space Grotesk', 'DM Sans'. Подбирай под настроение сайта.
3. Визуальный ритм: Чередуй фон между блоками (светлый/тёмный, градиент/плоский) — не слишком часто, для визуального ритма.
4. Стилизация: Скругленные углы (20-28px), многослойные тени, градиенты, стекломорфизм (backdrop-filter: blur(10px)).
5. Типографика: h1: clamp(48px, 8vw, 80px), h2: clamp(32px, 6vw, 48px), body: 16-18px.

## ПРАВИЛО 3: АНИМИРОВАННЫЙ ФОН
Фон страницы НЕ должен быть одноцветным. Используй градиент, который плавно переходит из одного цвета в другой, с анимацией движения:
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
Цвета градиента подбирай в зависимости от тематики сайта. Чтобы текст оставался читаемым, все блоки с текстом должны иметь светлый или полупрозрачный фон с достаточным контрастом.

## ПРАВИЛО 4: КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ
1. КНОПКИ: z-index min 10, header z-index 100, все кнопки кликабельны и видны. Кнопки НЕ должны перекрываться элементами интерфейса.
2. КОНТРАСТ ТЕКСТА: WCAG минимум 4.5:1. Тёмный текст (#111827, #1e293b) на светлом фоне, светлый текст (#f9fafb, #f1f5f9) на тёмном фоне. Для сложных фонов добавляй полупрозрачную подложку (background: rgba(0,0,0,0.6)) + text-shadow. Текст НЕ должен сливаться с фоном.
3. РАССТОЯНИЕ МЕЖДУ КНОПКАМИ: всегда используй display: flex; gap: 16-24px для групп кнопок. НЕ допускай расположение кнопок впритык.
4. ОБЪЁМНЫЙ ТЕКСТ: Пиши РАЗВЁРНУТЫЕ описания. Каждая карточка должна содержать 3-4 предложения с конкретными деталями, цифрами, преимуществами. Отзывы — 2-3 полноценных предложения. НЕ используй короткие фразы-заглушки типа "Описание товара", "Текст отзыва".

## ПРАВИЛО 5: КАРТИНКИ И АВАТАРКИ
- НЕ используй никакие внешние изображения (no picsum.photos, no unsplash, no local files)
- Для карточек используй цветные градиентные блоки с символьными значками (не смайлики):
  <div style="background: linear-gradient(135deg, #667eea, #764ba2); width:100%; height:200px; display:flex; align-items:center; justify-content:center; border-radius:20px; margin-bottom:16px;">
      <span style="font-size:56px;">✦</span>
  </div>
- Для аватарок используй randomuser.me: <img src="https://randomuser.me/api/portraits/women/1.jpg" style="width:64px; height:64px; border-radius:50%; object-fit:cover;">

## ПРАВИЛО 6: ИНТЕРАКТИВНЫЕ КАРТИНКИ
- Эффект при наведении на картинку: из чёрно-белого в цветной:
  <img src="..." class="hover-color" style="filter: grayscale(1); transition: all 0.4s;"
       onmouseover="this.style.filter='grayscale(0)'" onmouseout="this.style.filter='grayscale(1)'">
- Плейсхолдер для видео: картинка с иконкой play, которая увеличивается при наведении:
  <div class="video-placeholder" style="position: relative; cursor: pointer;">
    <img src="..." style="width:100%; border-radius:16px;">
    <div class="play-icon" style="position: absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:60px; height:60px; background:rgba(0,0,0,0.7); border-radius:50%; display:flex; align-items:center; justify-content:center; transition: transform 0.3s;">
      ▶
    </div>
  </div>
  (при наведении на .play-icon — transform: scale(1.1))

## ПРАВИЛО 7: КНОПКИ СО СТРЕЛКАМИ
- Кнопка со стрелкой: «Узнать больше →»
- При наведении стрелка сдвигается вправо:
  <button class="arrow-btn">Узнать больше <span class="arrow">→</span></button>
  .arrow-btn:hover .arrow { transform: translateX(5px); display: inline-block; transition: 0.2s; }
- Базовая кнопка: padding: 14px 32px, border-radius: 40px, gradient background, hover: translateY(-2px)

## ПРАВИЛО 8: АНИМИРОВАННАЯ СТРЕЛКА ВНИЗ
Внизу hero-секции добавить стрелку, которая плавно двигается вверх-вниз, указывая на контент ниже (одна на всю страницу):
  <div class="scroll-indicator" style="position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); animation: bounce 2s infinite; cursor: pointer; z-index: 10;">
    ↓
  </div>
  @keyframes bounce { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(10px); } }

## ПРАВИЛО 9: СИМВОЛЬНЫЕ ЗНАЧКИ
Используй простые символы вместо смайликов: ✦, ◆, ◇, ●, ○, ▸, ◂, ★, ☆, ♡, ♪, ☕, 🍔, 💻, 📱, 🎨, 🚀, ⚡, 🔥
Значки можно раскрашивать в акцентный цвет через color или filter.

## ПРАВИЛО 10: АНИМАЦИИ (ВСЕ ЭЛЕМЕНТЫ)
- Intersection Observer для анимации при скролле (fadeInUp, fadeInDown, fadeInLeft, fadeInRight, scaleIn)
- Карточки при загрузке: плавное появление с задержкой
- При наведении на карточку: scale(1.02-1.05), тень
- Плавный скролл по якорям: html { scroll-behavior: smooth; }

## ПРАВИЛО 11: СТРУКТУРА САЙТА (ОБЯЗАТЕЛЬНО)
1. Header: лого + навигация с якорями (бургер на мобильных), sticky, backdrop-filter: blur(10px), z-index: 100
2. Hero-секция: заголовок (clamp), описание, 2 кнопки с gap, анимированная стрелка вниз
3. Секция карточек: грид 3-4 колонки (каждая с градиентным блоком + символьным значком, заголовком и РАЗВЁРНУТЫМ описанием 3-4 предложения)
4. Секция отзывов: грид 3 колонки с аватарами, именами, звёздами и ПОЛНЫМИ отзывами (2-3 предложения)
5. Секция CTA: призыв + форма email + кнопка
6. Footer: навигация, соцсети, копирайт

## ПРАВИЛО 12: АДАПТИВНОСТЬ
- Медиа-запросы: 768px, 1024px
- На мобильных: padding: 16px, грид 1 колонка, кнопки full-width или stack вертикально с gap: 12px
- Шрифты уменьшаются плавно (clamp или медиа-запросы)
- Меню превращается в бургер (гамбургер иконка + выпадающее меню)

## ПРАВИЛО 13: ФОРМАТ ВЫВОДА
- Верни ТОЛЬКО HTML код
- Начинай с <!DOCTYPE html>
- Все стили внутри <style>, весь JavaScript внутри <script>
- Добавь мета-теги: viewport, description, theme-color
- НИКАКИХ пояснений, комментариев вне кода или текста после </html>
- Код должен быть полностью рабочим и готовым к копированию

Проверь перед отправкой: читаемость текста, кликабельность кнопок, адаптивность, объёмный текст в карточках и отзывах, анимированный градиент фона, контрастность.`;

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
        sendStatus('🔍 Анализ темы запроса...');
        
        let theme = 'абстракция';
        if (prompt.toLowerCase().includes('кофейн')) theme = 'кофе';
        else if (prompt.toLowerCase().includes('игр')) theme = 'игры';
        else if (prompt.toLowerCase().includes('фотограф')) theme = 'фотография';
        else if (prompt.toLowerCase().includes('it')) theme = 'технологии';
        else if (prompt.toLowerCase().includes('бизнес')) theme = 'бизнес';
        sendStatus(`🎯 Определена тема: ${theme}`);
        
        sendStatus('📄 Создание HTML вёрстки...');
        const response = await client.chat({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
        });
        
        let html = response.choices[0]?.message.content || '';
        sendStatus(`✅ HTML создан (${html.length} символов)`);
        
        html = html.replace(/```html\n?/gi, '').replace(/```\n?/gi, '');
        const htmlEndIndex = html.toLowerCase().lastIndexOf('</html>');
        if (htmlEndIndex !== -1) html = html.substring(0, htmlEndIndex + 7);
        
        html = html.replace(/<img[^>]+class="avatar"[^>]*>/gi, () => {
            const gender = Math.random() > 0.5 ? 'women' : 'men';
            const num = Math.floor(Math.random() * 90) + 1;
            return `<img src="https://randomuser.me/api/portraits/${gender}/${num}.jpg" style="width:64px; height:64px; border-radius:50%; object-fit:cover;">`;
        });
        
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
        
        res.write(`data: ${JSON.stringify({ type: 'result', html: html })}\n\n`);
        res.end();
        
    } catch (error) {
        console.error(`❌ ОШИБКА:`, error.message);
        
        let userMessage = error.message;
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            userMessage = '❌ Неверный ключ API. Проверьте настройки.';
        } else if (error.message.includes('429') || error.message.includes('quota')) {
            userMessage = '⚠️ Закончились токены. Смените модель на Lite.';
        } else if (error.message.includes('timeout')) {
            userMessage = '⏱️ Превышено время ожидания. Попробуйте упростить запрос.';
        }
        
        res.write(`data: ${JSON.stringify({ type: 'error', message: userMessage })}\n\n`);
        res.end();
    }
});

app.listen(3001, () => {
    console.log('\n🚀 СЕРВЕР: http://localhost:3001');
    console.log('🤖 Генерация сайтов через GigaChat-2-Pro\n');
});