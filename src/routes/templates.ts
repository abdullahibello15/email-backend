import express from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { replaceTemplateVariables } from "../services/emailService.js";

const router = express.Router();

const createTemplateSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  variables: z.record(z.string()).optional(),
});

// Get all templates
router.get("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const templates = await prisma.template.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ templates });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// Get single template
router.get("/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const template = await prisma.template.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json({ template });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch template" });
  }
});

// Create template
router.post("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const data = createTemplateSchema.parse(req.body);

    const template = await prisma.template.create({
      data: { ...data, userId: req.user!.id },
    });

    res.status(201).json({ template });
  } catch (error) {
    res.status(400).json({ error: "Failed to create template" });
  }
});

// Update template
router.put("/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const data = createTemplateSchema.parse(req.body);

    const existing = await prisma.template.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Template not found" });
    }

    const template = await prisma.template.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ template });
  } catch (error) {
    res.status(400).json({ error: "Failed to update template" });
  }
});

// Delete template
router.delete("/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await prisma.template.deleteMany({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json({ message: "Template deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete template" });
  }
});

// Preview template with variables
router.post(
  "/:id/preview",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const template = await prisma.template.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
      });

      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      const variables: Record<string, string> = req.body.variables || {};

      const previewSubject = await replaceTemplateVariables(
        template.subject,
        variables,
      );
      const previewBody = await replaceTemplateVariables(
        template.body,
        variables,
      );

      res.json({
        preview: {
          subject: previewSubject,
          body: previewBody,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to preview template" });
    }
  },
);

export default router;
