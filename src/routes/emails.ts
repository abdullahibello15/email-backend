import express from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { sendEmail } from "../services/emailService.js";
import { addScheduledEmailJob } from "../services/queueService.js";

const router = express.Router();

const createEmailSchema = z.object({
  to: z.array(z.string().email()),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string(),
  body: z.string(),
  htmlBody: z.string(),
  scheduledAt: z.string().datetime().optional(),
  isDraft: z.boolean().optional(),
});

// Create / send email
router.post("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const data = createEmailSchema.parse(req.body);
    const userId = req.user!.id;

    // Look up user IDs for any recipients that exist in the system
    const allRecipientEmails = [
      ...data.to,
      ...(data.cc || []),
      ...(data.bcc || []),
    ];

    const existingUsers = await prisma.user.findMany({
      where: { email: { in: allRecipientEmails } },
      select: { id: true, email: true },
    });

    const emailToUserId = new Map(existingUsers.map((u) => [u.email, u.id]));

    const email = await prisma.email.create({
      data: {
        subject: data.subject,
        body: data.body,
        htmlBody: data.htmlBody,
        senderId: userId,
        status: data.isDraft
          ? "DRAFT"
          : data.scheduledAt
            ? "SCHEDULED"
            : "DRAFT",
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        recipients: {
          create: [
            ...data.to.map((email) => ({
              email,
              type: "TO" as const,
              userId: emailToUserId.get(email) || null,
            })),
            ...(data.cc || []).map((email) => ({
              email,
              type: "CC" as const,
              userId: emailToUserId.get(email) || null,
            })),
            ...(data.bcc || []).map((email) => ({
              email,
              type: "BCC" as const,
              userId: emailToUserId.get(email) || null,
            })),
          ],
        },
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        recipients: true,
      },
    });

    if (data.scheduledAt) {
      await addScheduledEmailJob(email.id, new Date(data.scheduledAt));
      res.status(201).json({ message: "Email scheduled successfully", email });
    } else if (!data.isDraft) {
      await sendEmail(email.id);
      res.status(201).json({ message: "Email sent successfully", email });
    } else {
      res.status(201).json({ message: "Draft saved successfully", email });
    }
  } catch (error) {
    console.error("Create email error:", error);
    res.status(400).json({ error: "Failed to create email" });
  }
});

// Get inbox
router.get("/inbox", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { search, label, read } = req.query;

    const where: any = {
      recipients: {
        some: {
          OR: [{ userId: req.user!.id }, { email: req.user!.email }],
        },
      },
    };

    if (search) {
      where.OR = [
        { subject: { contains: search as string, mode: "insensitive" } },
        { body: { contains: search as string, mode: "insensitive" } },
      ];
    }

    if (label && label !== "all") {
      where.labels = { some: { label: label as string } };
    }

    if (read === "unread") {
      where.recipients.some.read = false;
    } else if (read === "read") {
      where.recipients.some.read = true;
    }

    const emails = await prisma.email.findMany({
      where,
      include: {
        sender: { select: { id: true, name: true, email: true } },
        recipients: true,
        labels: true,
        attachments: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({ emails });
  } catch (error) {
    console.error("Get inbox error:", error);
    res.status(500).json({ error: "Failed to fetch emails" });
  }
});

// Get sent emails
router.get("/sent", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const emails = await prisma.email.findMany({
      where: { senderId: req.user!.id, status: "SENT" },
      include: {
        recipients: true,
        labels: true,
        attachments: true,
      },
      orderBy: { sentAt: "desc" },
      take: 100,
    });

    res.json({ emails });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sent emails" });
  }
});

// Get drafts
router.get("/drafts", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const emails = await prisma.email.findMany({
      where: { senderId: req.user!.id, status: "DRAFT" },
      include: { recipients: true },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ emails });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch drafts" });
  }
});

// Get single email
router.get("/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const email = await prisma.email.findUnique({
      where: { id: req.params.id },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        recipients: true,
        labels: true,
        attachments: true,
      },
    });

    if (!email) {
      return res.status(404).json({ error: "Email not found" });
    }

    res.json({ email });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch email" });
  }
});

// Mark as read
router.patch("/:id/read", authenticateToken, async (req: AuthRequest, res) => {
  try {
    await prisma.emailRecipient.updateMany({
      where: { emailId: req.params.id, userId: req.user!.id },
      data: { read: true, readAt: new Date() },
    });

    res.json({ message: "Email marked as read" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update email" });
  }
});

// Delete email
router.delete("/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const email = await prisma.email.findFirst({
      where: { id: req.params.id, senderId: req.user!.id },
    });

    if (!email) {
      return res.status(404).json({ error: "Email not found" });
    }

    await prisma.email.delete({ where: { id: req.params.id } });
    res.json({ message: "Email deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete email" });
  }
});

export default router;
