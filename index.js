const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();

function loadEnvFile() {
    const envPath = path.join(__dirname, ".env");
    if (!fs.existsSync(envPath)) return;

    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex === -1) continue;

        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
        if (key && process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

loadEnvFile();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const User = require("./models/user.js");
const Chat = require("./models/chat.js");
const bcrypt = require("bcrypt");
app.use(express.static(path.join(__dirname, "views")));


app.use(require("express-session")({
    secret: "secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false, 
        maxAge: 1000 * 60 * 60
    }
}));

const mongoose = require("mongoose");
mongoose.connect("mongodb+srv://mohamedNode0:Sudo9864235@cluster0.ooyzru5.mongodb.net/?appName=Cluster0")
.then(() => {
    console.log("connected sucssufly");

}).catch((error) => {
    console.log("error", error);
});

function isLoggedIn(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    return res.redirect("/login.html");
}

function redirectIfLoggedIn(req, res, next) {
    if (req.session.userId) {
        return res.redirect("/chat");
    }
    next();
}

function createWelcomeMessage() {
    return {
        role: "assistant",
        content: "Merhaba. Ben HELP BRO proje asistanıyım. MVP, backlog, Gemini entegrasyonu, chat arayuzu ve Mermaid.js flowchart ozelligi hakkinda yardimci olabilirim."
    };
}

function serializeChat(chat) {
    return {
        id: String(chat._id),
        title: chat.title,
        messages: chat.messages.map((message) => ({
            role: message.role,
            content: message.content
        }))
    };
}

function sanitizeMessages(messages) {
    return messages
        .filter((message) =>
            message &&
            (message.role === "user" || message.role === "assistant") &&
            typeof message.content === "string" &&
            message.content.trim() !== ""
        )
        .map((message) => ({
            role: message.role,
            content: message.content.trim()
        }));
}

function createChatTitle(messages, fallbackTitle) {
    const firstUserMessage = messages.find((message) => message.role === "user");
    if (!firstUserMessage) return fallbackTitle;

    const title = firstUserMessage.content.replace(/\s+/g, " ").trim();
    return title.length > 34 ? title.slice(0, 34) + "..." : title;
}

async function createDefaultChat(userId, number = 1) {
    const chat = new Chat({
        userId,
        title: "Chat " + number,
        messages: [createWelcomeMessage()]
    });

    await chat.save();
    return chat;
}

function toGeminiContents(messages) {
    const contents = messages
        .filter((message) => message && typeof message.content === "string")
        .map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content.trim() }]
        }))
        .filter((message) => message.parts[0].text !== "");

    while (contents[0]?.role === "model") {
        contents.shift();
    }

    return contents;
}

function readGeminiText(data) {
    return data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();
}

function toOpenAIInput(messages) {
    return messages
        .filter((message) => message && typeof message.content === "string")
        .map((message) => ({
            role: message.role === "assistant" ? "assistant" : "user",
            content: message.content.trim()
        }))
        .filter((message) => message.content !== "");
}

function readOpenAIText(data) {
    if (typeof data.output_text === "string" && data.output_text.trim()) {
        return data.output_text.trim();
    }

    return data.output
        ?.flatMap((item) => item.content || [])
        ?.map((content) => content.text || "")
        ?.join("")
        .trim();
}

function extractJsonObject(text) {
    const cleaned = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```$/i, "")
        .trim();

    try {
        return JSON.parse(cleaned);
    } catch (error) {
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) {
            return JSON.parse(cleaned.slice(start, end + 1));
        }
        throw error;
    }
}

function parseFlowchartReply(text) {
    try {
        return extractJsonObject(text);
    } catch (error) {
        const cleaned = text
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/```$/i, "")
            .trim();
        const looseMatch = cleaned.match(/"summary"\s*:\s*"([\s\S]*?)"\s*,\s*"mermaid"\s*:\s*"([\s\S]*?)"\s*}\s*$/);

        if (!looseMatch) {
            throw error;
        }

        return {
            summary: looseMatch[1].replace(/\\"/g, "\"").replace(/\\n/g, "\n").trim(),
            mermaid: looseMatch[2].replace(/\\"/g, "\"").replace(/\\n/g, "\n").trim()
        };
    }
}

function createHttpError(message, statusCode = 500) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function normalizeGeminiError(message, statusCode) {
    if (/quota|credit|billing|rate limit|rate-limit|too many requests|high demand/i.test(message)) {
        const error = createHttpError(message, statusCode || 429);
        error.isQuotaError = true;
        return error;
    }

    if (/denied access/i.test(message)) {
        return createHttpError(
            "Gemini rejected this API key/project. Create a new Gemini API key in Google AI Studio or use a Google project that has Gemini API access.",
            403
        );
    }

    if (/api key|permission|unauthenticated|forbidden/i.test(message)) {
        return createHttpError(
            "Gemini API authentication failed. Check GEMINI_API_KEY in .env and restart the server.",
            statusCode || 401
        );
    }

    return createHttpError(message, statusCode || 500);
}

function normalizeOpenAIError(message, statusCode) {
    if (/quota|credit|billing|rate limit|rate-limit|too many requests/i.test(message)) {
        const error = createHttpError(message, statusCode || 429);
        error.isQuotaError = true;
        return error;
    }

    if (/api key|permission|unauthorized|forbidden|authentication/i.test(message)) {
        return createHttpError(
            "OpenAI API authentication failed. Check OPENAI_API_KEY in .env and restart the server.",
            statusCode || 401
        );
    }

    return createHttpError(message, statusCode || 500);
}

const HELP_BRO_SYSTEM_INSTRUCTION = `You are HELP BRO's Project Analysis AI.

MISSION

HELP BRO transforms raw ideas into structured project workflows.

Users may have zero technical knowledge.

Your role is to:

* Understand project ideas.
* Ask intelligent follow-up questions.
* Discover requirements.
* Clarify business logic.
* Identify workflows and decision points.
* Organize ideas into a structured project specification.
* Produce Mermaid.js-ready workflow descriptions.

HELP BRO IS NOT A GENERAL CHATBOT.

It is a project analysis and workflow discovery assistant.

ALLOWED TOPICS

* Startup ideas
* Mobile app ideas
* Web application ideas
* SaaS products
* Internal business tools
* Automation systems
* E-commerce platforms
* Educational platforms
* Marketplace concepts
* Business processes
* Customer journeys
* User workflows
* Product requirements

RESTRICTED BEHAVIOR

Do not engage in unrelated conversation.

If the user asks something outside project analysis, respond:

"HELP BRO focuses on analyzing projects, workflows, product ideas, and system requirements. Please describe the idea or process you want to build."

DISCOVERY PROCESS

When a user provides an idea:

Step 1: Understand the concept.

Step 2: Identify the most important missing information.

Step 3: Ask one natural follow-up question or one small group of closely related questions.

The conversation should feel like a discussion with a business analyst, not an interview or questionnaire.

GUIDELINES FOR ASKING QUESTIONS

* Be conversational and human-like.
* Avoid asking large batches of questions at once.
* Ask only what is needed for the next step of understanding.
* Build on the user's previous answer.
* Show understanding before asking the next question.
* Use short transitions such as:

  * "That makes sense."
  * "Interesting idea."
  * "Let's explore that part a bit more."
  * "I want to understand how this works in practice."
* Prefer a continuous dialogue over a checklist.

For example:

Instead of:

"Who are the users? What data is stored? Are notifications required? Are payments required?"

Use:

"I understand the main idea. Who would be the primary users of this system?"

Then continue based on the user's answer.

QUESTIONS MAY EVENTUALLY COVER

* Who will use it?
* What problem does it solve?
* What actions can users perform?
* What information is stored?
* Are there different user roles?
* Are payments required?
* Are notifications required?
* Does approval or review exist?
* What happens in failure scenarios?

Continue the conversation until the workflow is sufficiently defined.

DO NOT ASSUME REQUIREMENTS.

DO NOT RUSH TO GENERATE THE FINAL SPECIFICATION.

Only generate the final analysis when enough information has been collected and confidence is high.

ANALYSIS OUTPUT

After collecting enough information, generate:

1. Project Summary

* Purpose
* Target users
* Core value

2. User Roles

* Role definitions

3. Functional Requirements

* Numbered requirements

4. Workflow Analysis

* Main process
* Alternative paths
* Failure paths

5. Data Entities

* Main objects and relationships

6. Mermaid Workflow Specification

Structured workflow description suitable for Mermaid generation.

7. Mermaid Generation Prompt

Generate a detailed prompt instructing an AI model to create a Mermaid.js flowchart representing the entire workflow.

RESPONSE STYLE

* Professional but friendly.
* Conversational.
* Curious and analytical.
* Easy for non-technical users to understand.
* Focused on discovering requirements through dialogue.
* No overwhelming lists of questions.

FINAL OBJECTIVE

Transform vague ideas into complete workflow specifications and Mermaid-ready project structures through a natural conversation, regardless of the user's technical background.


`;

async function askGemini(messages) {
    return askAiWithInstruction(messages, HELP_BRO_SYSTEM_INSTRUCTION);
}

async function askGeminiWithInstruction(messages, systemInstruction, generationConfig = {}) {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    if (!apiKey) {
        throw createHttpError("GEMINI_API_KEY is missing in .env", 500);
    }

    const contents = toGeminiContents(messages);
    if (contents.length === 0) {
        throw new Error("Message is required");
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: systemInstruction }]
                },
                contents,
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 1024,
                    ...generationConfig
                }
            })
        }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = data?.error?.message || `Gemini request failed with status ${response.status}`;
        throw normalizeGeminiError(message, response.status);
    }

    const reply = readGeminiText(data);
    if (!reply) {
        throw new Error("Gemini did not return a text response");
    }

    return reply;
}

async function askOpenAIWithInstruction(messages, systemInstruction, options = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    if (!apiKey) {
        throw createHttpError("OPENAI_API_KEY is missing in .env", 500);
    }

    const input = toOpenAIInput(messages);
    if (input.length === 0) {
        throw new Error("Message is required");
    }

    const body = {
        model,
        instructions: systemInstruction,
        input,
        temperature: 0.2,
        max_output_tokens: options.maxOutputTokens || 1024
    };

    if (options.json) {
        body.text = { format: { type: "json_object" } };
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = data?.error?.message || `OpenAI request failed with status ${response.status}`;
        throw normalizeOpenAIError(message, response.status);
    }

    const reply = readOpenAIText(data);
    if (!reply) {
        throw new Error("OpenAI did not return a text response");
    }

    return reply;
}

async function askAiWithInstruction(messages, systemInstruction, options = {}) {
    try {
        return await askGeminiWithInstruction(messages, systemInstruction, options.geminiGenerationConfig || {});
    } catch (error) {
        if (!error.isQuotaError) {
            throw error;
        }

        console.warn("Gemini quota/credits reached. Falling back to OpenAI.");
        return askOpenAIWithInstruction(messages, systemInstruction, {
            json: options.json,
            maxOutputTokens: options.maxOutputTokens
        });
    }
}

const MERMAID_FLOWCHART_SYSTEM_INSTRUCTION = `
You convert HELP BRO project conversations into Mermaid.js flowcharts.

Return only valid JSON with this exact shape:
{
  "summary": "A concise project-focused summary of the conversation.",
  "mermaid": "A valid Mermaid flowchart diagram."
}

Rules:
- The mermaid value must start with flowchart TD.
- Escape newlines in the mermaid JSON string as \\n.
- Use simple node labels that describe project steps, features, decisions, and data flow.
- Avoid markdown fences.
- Avoid quotes inside Mermaid node labels when possible.
- Keep the chart useful for software project planning.
`;

async function createMermaidFlowchart(messages) {
    const conversationText = messages
        .filter((message) => message && typeof message.content === "string")
        .map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content.trim()}`)
        .join("\n\n");

    if (!conversationText.trim()) {
        throw createHttpError("Conversation is empty", 400);
    }

    const prompt = `
Summarize this HELP BRO chat conversation, then generate a Mermaid.js flowchart for the project logic discussed.

Conversation:
${conversationText}
`;

    const reply = await askAiWithInstruction(
        [{ role: "user", content: prompt }],
        MERMAID_FLOWCHART_SYSTEM_INSTRUCTION,
        {
            json: true,
            geminiGenerationConfig: {
                responseMimeType: "application/json"
            }
        }
    );
    const parsed = parseFlowchartReply(reply);

    if (!parsed.summary || !parsed.mermaid) {
        throw createHttpError("AI did not return summary and Mermaid chart data", 500);
    }

    return {
        summary: String(parsed.summary).trim(),
        mermaid: String(parsed.mermaid).trim()
    };
}

app.get("/image", (req, res) => {
  res.sendFile(__dirname + "/views/msenn2.jpeg");
});

app.get("/",(req,res)=>{
    res.sendFile(__dirname + "/views/homePage.html");
});

app.get("/register.html",(req,res)=>{
    res.sendFile(__dirname + "/views/register.html");
});

app.get("/login.html", redirectIfLoggedIn, (req, res) => {
    res.sendFile(__dirname + "/views/login.html");
});

app.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const isExist = await User.findOne({email});
            if (isExist){return res.sendFile(__dirname + "/views/regesterError.html");}
        const hashed = await bcrypt.hash(password, 10);

        const newUser = new User({
            username,
            email,
            password: hashed
        });

        await newUser.save();

        res.sendFile(__dirname + "/views/succesR.html");
    } catch (err) {
        res.send("Error: " + err.message);
    }
});

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        
        const user = await User.findOne({ email });
        if (!user) {
            return res.sendFile(__dirname + "/views/loginError.html");
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.sendFile(__dirname + "/views/passwdErrror.html");
        }

        
        req.session.userId = user._id;

        res.redirect("/chat");

    } catch (err) {
        res.send("Error: " + err.message);
    }
});

app.get("/api/chats", isLoggedIn, async (req, res) => {
    try {
        let chats = await Chat.find({ userId: req.session.userId }).sort({ updatedAt: -1 });

        if (chats.length === 0) {
            const firstChat = await createDefaultChat(req.session.userId);
            chats = [firstChat];
        }

        res.json({ chats: chats.map(serializeChat) });
    } catch (err) {
        console.error("Load chats error:", err.message);
        res.status(500).json({ error: "Could not load saved conversations" });
    }
});

app.post("/api/chats", isLoggedIn, async (req, res) => {
    try {
        const chatCount = await Chat.countDocuments({ userId: req.session.userId });
        const chat = await createDefaultChat(req.session.userId, chatCount + 1);
        res.status(201).json({ chat: serializeChat(chat) });
    } catch (err) {
        console.error("Create chat error:", err.message);
        res.status(500).json({ error: "Could not create a new conversation" });
    }
});

app.post("/api/chat", isLoggedIn, async (req, res) => {
    try {
        const messages = sanitizeMessages(Array.isArray(req.body.messages) ? req.body.messages : []);
        const chat = await Chat.findOne({
            _id: req.body.chatId,
            userId: req.session.userId
        });

        if (!chat) {
            throw createHttpError("Conversation not found", 404);
        }

        chat.messages = messages;
        chat.title = createChatTitle(messages, chat.title);
        await chat.save();

        const reply = await askGemini(messages);
        const nextMessages = [
            ...messages,
            { role: "assistant", content: reply }
        ];

        chat.messages = nextMessages;
        chat.title = createChatTitle(nextMessages, chat.title);
        await chat.save();

        res.json({ reply, chat: serializeChat(chat) });
    } catch (err) {
        console.error("Gemini chat error:", err.message);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

app.post("/api/flowchart", isLoggedIn, async (req, res) => {
    try {
        let messages = sanitizeMessages(Array.isArray(req.body.messages) ? req.body.messages : []);

        if (req.body.chatId) {
            const chat = await Chat.findOne({
                _id: req.body.chatId,
                userId: req.session.userId
            });

            if (chat) {
                messages = sanitizeMessages(chat.messages);
            }
        }

        const flowchart = await createMermaidFlowchart(messages);
        res.json(flowchart);
    } catch (err) {
        console.error("Gemini flowchart error:", err.message);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

app.get("/chat", isLoggedIn, (req, res) => {
    res.sendFile(__dirname + "/views/chat.html");
});



app.listen(443,()=>{
    console.log("server running on port 443")
})
