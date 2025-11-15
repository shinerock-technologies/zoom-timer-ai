import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const app = express();
const PORT = 3001;

// CORS configuration
const corsOptions = {
  origin: ["http://localhost:3000", "https://app.meetingtimer.pro"],
  methods: ["GET", "POST"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Authentication middleware
const authenticateRequest = (req, res, next) => {
  const origin = req.get("origin");
  const referer = req.get("referer");
  const apiToken = req.get("x-api-token");

  // Get secret token from environment
  const SECRET_TOKEN =
    process.env.VITE_API_SECRET_TOKEN || process.env.API_SECRET_TOKEN;

  // Check if request is from allowed origins (browser requests)
  const allowedOrigins = [
    "http://localhost:3000",
    "https://app.meetingtimer.pro",
  ];

  const isFromAllowedOrigin = allowedOrigins.some(
    (allowed) => origin === allowed || referer?.startsWith(allowed)
  );

  // If from allowed origin, allow through
  if (isFromAllowedOrigin) {
    return next();
  }

  // Otherwise, require API token (for Postman/curl)
  if (!SECRET_TOKEN) {
    console.warn(
      "Warning: VITE_API_SECRET_TOKEN not configured in environment"
    );
    return res.status(500).json({
      error: "Server configuration error: API token not set",
    });
  }

  if (!apiToken || apiToken !== SECRET_TOKEN) {
    return res.status(401).json({
      error:
        "Unauthorized: Valid API token required. Include 'x-api-token' header.",
    });
  }

  next();
};

app.post("/api/generate", authenticateRequest, async (req, res) => {
  const { prompt, type, currentRoom, currentTimer } = req.body;
  const OPENAI_API_KEY =
    process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "OpenAI API key not configured" });
  }

  let systemPrompt;
  let userPrompt = prompt;
  let maxTokens = 1000;

  if (type === "timer") {
    systemPrompt = `You are a single timer generator. Given a user's description, create one timer with appropriate settings.

Return ONLY a valid JSON object with this exact structure:
{
  "title": "Timer name",
  "message": "Brief description",
  "seconds": 300
}

Rules:
- title should be concise and descriptive (2-5 words)
- message should be brief and helpful (what to do during this timer)
- seconds should be realistic for the activity
- Parse time expressions like "5 minutes", "1 hour", "30 seconds", "25 minute focus session"
- If no time is specified, infer an appropriate duration based on the activity
- Examples:
  - "5 minute break" → 300 seconds, message about resting
  - "focus session" → 1500 seconds (25 min), message about deep work
  - "standup meeting" → 600 seconds (10 min), message about team updates`;
    maxTokens = 300;
  } else if (type === "editTimer") {
    if (
      !currentTimer ||
      !currentTimer.title ||
      typeof currentTimer.totalSeconds !== "number"
    ) {
      return res
        .status(400)
        .json({ error: "Valid current timer data is required" });
    }

    systemPrompt = `You are a timer editor. Given a user's modification request and the current timer, update the timer accordingly.

Current timer:
- Title: ${currentTimer.title}
- Message: ${currentTimer.message || "none"}
- Duration: ${currentTimer.totalSeconds} seconds (${Math.floor(
      currentTimer.totalSeconds / 60
    )}:${String(currentTimer.totalSeconds % 60).padStart(2, "0")})

Return ONLY a valid JSON object with this exact structure:
{
  "title": "Updated timer name",
  "message": "Updated description",
  "seconds": 300
}

Rules:
- Only change what the user asks to change
- Keep other fields the same if not mentioned
- Parse time expressions like "5 minutes longer", "change to 10 minutes", "add 30 seconds"
- title should be concise and descriptive (2-5 words)
- message should be brief and helpful (what to do during this timer)
- seconds should be realistic for the activity
- If user asks to change the name/title, update the title field
- If user asks to add/change description or message, update the message field`;
    maxTokens = 500;
  } else if (type === "edit") {
    systemPrompt = `You are a timer room editor. Given the current room state and a user's edit request, modify the timers accordingly.

Return ONLY a valid JSON object with this exact structure:
{
  "timers": [
    {
      "title": "Timer name",
      "message": "Brief description",
      "seconds": 300
    }
  ]
}

Rules:
- Understand edit requests like "add a 5 minute break", "make all timers 2 minutes longer", "remove the last timer", "change the first timer to 10 minutes"
- Keep existing timers unless specifically asked to modify or remove them
- Add new timers when requested
- Modify timer durations, titles, or messages as requested
- Return ALL timers (modified and unmodified) in the correct order
- Parse time expressions like "5 minutes", "1 hour", "30 seconds"`;

    // Add current room context to the prompt
    if (currentRoom && currentRoom.timers) {
      const timersList = currentRoom.timers
        .map(
          (t, i) =>
            `${i + 1}. "${t.title}" - ${Math.floor(
              t.totalSeconds / 60
            )}:${String(t.totalSeconds % 60).padStart(2, "0")} (${
              t.message || "no description"
            })`
        )
        .join("\n");

      userPrompt = `Current room: "${currentRoom.roomName}"\nCurrent timers:\n${timersList}\n\nEdit request: ${prompt}`;
    }
    maxTokens = 1500;
  } else if (type === "room") {
    systemPrompt = `You are a timer room generator. Given a user's description, create a structured timer sequence.

Return ONLY a valid JSON object with this exact structure:
{
  "roomName": "Name of the timer room",
  "timers": [
    {
      "title": "Timer name",
      "message": "Brief description",
      "seconds": 300
    }
  ]
}

Rules:
- roomName should be concise and descriptive
- Each timer needs title, message, and seconds (as a number)
- Seconds should be realistic (60-3600 typically)
- Create 3-8 timers depending on the activity
- Order timers logically

Examples:
- "sales pitch" → timers for intro, problem, solution, demo, pricing, Q&A, close
- "morning routine" → timers for exercise, shower, breakfast, planning
- "team meeting" → timers for check-in, updates, discussion, action items`;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({
        error: error.error?.message || "Failed to generate",
      });
    }

    const data = await response.json();
    let content = data.choices[0].message.content.trim();

    // Remove markdown code blocks if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "");

    const result = JSON.parse(content);

    return res.status(200).json(result);
  } catch (error) {
    console.error("OpenAI API error:", error);
    return res.status(500).json({
      error: error.message || "Failed to generate",
    });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
