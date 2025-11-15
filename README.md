# Zoom Timer AI API

AI-powered API server for generating timer sequences using OpenAI.

## Features

- Generate complete timer rooms from descriptions
- Edit existing timer rooms with AI
- Create single timers with natural language
- Edit individual timers with AI assistance
- CORS protection for allowed origins
- API token authentication for external tools

## Setup

### Local Development

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` file:

```bash
cp .env.example .env.local
```

3. Add your API keys to `.env.local`:

```
VITE_OPENAI_API_KEY=sk-your-openai-api-key
VITE_API_SECRET_TOKEN=your-secret-token
```

4. Start the server:

```bash
npm start
```

Server runs on `http://localhost:3001`

### Vercel Deployment

1. Install Vercel CLI:

```bash
npm i -g vercel
```

2. Deploy:

```bash
vercel
```

3. Set environment variables in Vercel dashboard:
   - `VITE_OPENAI_API_KEY`
   - `VITE_API_SECRET_TOKEN`

Or use CLI:

```bash
vercel env add VITE_OPENAI_API_KEY
vercel env add VITE_API_SECRET_TOKEN
```

## API Endpoints

### POST /api/generate

Generate timers using AI.

**Headers:**

- `Content-Type: application/json`
- `x-api-token: your-token` (only required for non-browser requests)

**Request Body:**

```json
{
  "prompt": "sales pitch presentation",
  "type": "room"
}
```

**Types:**

- `room` - Generate complete timer room
- `timer` - Generate single timer
- `edit` - Edit existing room
- `editTimer` - Edit single timer

**Response:**

```json
{
  "roomName": "Sales Pitch",
  "timers": [
    {
      "title": "Introduction",
      "message": "Hook and intro",
      "seconds": 180
    }
  ]
}
```

## CORS Configuration

Allowed origins:

- `http://localhost:3000` (development)
- `https://app.meetingtimer.pro` (production)

External tools (Postman, curl) require `x-api-token` header.

## Example Usage

### Browser (from allowed origin)

```javascript
const response = await fetch("https://your-api.vercel.app/api/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "5 minute break",
    type: "timer",
  }),
});
```

### curl (with token)

```bash
curl -X POST https://your-api.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -H "x-api-token: your-secret-token" \
  -d '{"prompt": "5 minute break", "type": "timer"}'
```

## License

MIT
# zoom-timer-ai
# zoom-timer-ai
