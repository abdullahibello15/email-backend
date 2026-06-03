import express from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const router = express.Router();

const createAutomationSchema = z.object({
  name: z.string().min(1),
  triggerType: z.enum([
    "USER_CREATED",
    "EMAIL_RECEIVED",
    "SCHEDULED",
    "LABEL_ADDED",
  ]),
  triggerData: z.record(z.any()).optional(),
  actionType: z.enum(["SEND_EMAIL", "ADD_LABEL", "FORWARD", "ARCHIVE"]),
  actionData: z.record(z.any()).optional(),
  enabled: z.boolean().default(true),
});

// Get all automations
router.get("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const automations = await prisma.automation.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });

    res.json({ automations });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch automations" });
  }
});

// Get single automation
router.get("/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const automation = await prisma.automation.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!automation) {
      return res.status(404).json({ error: "Automation not found" });
    }

    res.json({ automation });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch automation" });
  }
});

// Create automation
router.post("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const data = createAutomationSchema.parse(req.body);

    const automation = await prisma.automation.create({
      data: { ...data, userId: req.user!.id },
    });

    res.status(201).json({ automation });
  } catch (error) {
    res.status(400).json({ error: "Failed to create automation" });
  }
});

// Update automation
router.put("/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const data = createAutomationSchema.parse(req.body);

    const existing = await prisma.automation.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Automation not found" });
    }

    const automation = await prisma.automation.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ automation });
  } catch (error) {
    res.status(400).json({ error: "Failed to update automation" });
  }
});

// Toggle automation on/off
router.patch(
  "/:id/toggle",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const automation = await prisma.automation.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
      });

      if (!automation) {
        return res.status(404).json({ error: "Automation not found" });
      }

      const updated = await prisma.automation.update({
        where: { id: req.params.id },
        data: { enabled: !automation.enabled },
      });

      res.json({
        message: `Automation ${updated.enabled ? "enabled" : "disabled"} successfully`,
        automation: updated,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle automation" });
    }
  },
);

// Delete automation
router.delete("/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await prisma.automation.deleteMany({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: "Automation not found" });
    }

    res.json({ message: "Automation deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete automation" });
  }
});

export default router;
