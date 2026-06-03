import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// --- Core AI functions ---

export async function rewriteWithTone(
  text: string,
  tone: string,
): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Rewrite the following email text with a ${tone} tone. Return only the rewritten text, no explanations:\n\n${text}`,
      },
    ],
  });

  const content = message.content[0];
  return content.type === "text" ? content.text : "";
}

export async function generateSubject(emailBody: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 100,
    messages: [
      {
        role: "user",
        content: `Generate a concise, professional email subject line (max 10 words) for the following email. Return only the subject line, no explanations:\n\n${emailBody}`,
      },
    ],
  });

  const content = message.content[0];
  return content.type === "text" ? content.text.trim() : "";
}

export async function expandBulletPoints(bullets: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Expand these bullet points into a professional, well-structured email. Return only the email body, no explanations:\n\n${bullets}`,
      },
    ],
  });

  const content = message.content[0];
  return content.type === "text" ? content.text : "";
}

export async function generateReply(emailBody: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Generate a professional reply to this email. Return only the reply text, no explanations:\n\n${emailBody}`,
      },
    ],
  });

  const content = message.content[0];
  return content.type === "text" ? content.text : "";
}

export async function summarizeEmail(emailBody: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `Summarize this email in 2-3 sentences. Return only the summary, no explanations:\n\n${emailBody}`,
      },
    ],
  });

  const content = message.content[0];
  return content.type === "text" ? content.text : "";
}

// --- Router ---

export const aiRouter = express.Router();

aiRouter.post("/rewrite", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { text, tone } = req.body;
    if (!text || !tone) {
      return res.status(400).json({ error: "text and tone are required" });
    }
    const result = await rewriteWithTone(text, tone);
    res.json({ result });
  } catch (error) {
    console.error("AI rewrite error:", error);
    res.status(500).json({ error: "AI rewrite failed" });
  }
});

aiRouter.post(
  "/generate-subject",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { body } = req.body;
      if (!body) {
        return res.status(400).json({ error: "body is required" });
      }
      const result = await generateSubject(body);
      res.json({ result });
    } catch (error) {
      console.error("Subject generation error:", error);
      res.status(500).json({ error: "Subject generation failed" });
    }
  },
);

aiRouter.post("/expand", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { bullets } = req.body;
    if (!bullets) {
      return res.status(400).json({ error: "bullets is required" });
    }
    const result = await expandBulletPoints(bullets);
    res.json({ result });
  } catch (error) {
    console.error("Expand error:", error);
    res.status(500).json({ error: "Expansion failed" });
  }
});

aiRouter.post("/reply", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { emailBody } = req.body;
    if (!emailBody) {
      return res.status(400).json({ error: "emailBody is required" });
    }
    const result = await generateReply(emailBody);
    res.json({ result });
  } catch (error) {
    console.error("Reply generation error:", error);
    res.status(500).json({ error: "Reply generation failed" });
  }
});

aiRouter.post(
  "/summarize",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { emailBody } = req.body;
      if (!emailBody) {
        return res.status(400).json({ error: "emailBody is required" });
      }
      const result = await summarizeEmail(emailBody);
      res.json({ result });
    } catch (error) {
      console.error("Summarize error:", error);
      res.status(500).json({ error: "Summarization failed" });
    }
  },
);
