# Book Carousel Generator

AI-генератор продающих каруселей для книг на маркетплейсах.

## Quick Start

\`\`\`bash
npm install
cp .env.example .env.local
# Add GEMINI_API_KEY
npm run dev
\`\`\`

Open http://localhost:3000

## Deploy

\`\`\`bash
vercel
\`\`\`

## Local Development

В режиме разработки (`npm run dev`) используется локальный Nano Banana модуль для генерации.
Это быстрее и удобнее для тестирования.

В production на Vercel используется Python Serverless Function.

### Требования для локальной разработки

- Python 3.9+
- Установленный модуль `google-genai`

```bash
pip install google-genai Pillow
```
