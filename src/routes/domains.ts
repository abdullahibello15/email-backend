import express from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const router = express.Router();

// Admin-only middleware
const requireAdmin = (
  req: AuthRequest,
  res: express.Response,
  next: express.NextFunction,
) => {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

const createDomainSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/, {
      message: "Invalid domain format (e.g. company.com)",
    }),
});

// GET /api/domains — list all domains
router.get(
  "/",
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const domains = await prisma.domain.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      res.json({ domains });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch domains" });
    }
  },
);

// GET /api/domains/:id — get single domain
router.get(
  "/:id",
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const domain = await prisma.domain.findUnique({
        where: { id: req.params.id },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      if (!domain) {
        return res.status(404).json({ error: "Domain not found" });
      }

      res.json({ domain });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch domain" });
    }
  },
);

// POST /api/domains — create domain
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const { name } = createDomainSchema.parse(req.body);

      const existing = await prisma.domain.findUnique({ where: { name } });
      if (existing) {
        return res.status(409).json({ error: "Domain already exists" });
      }

      const domain = await prisma.domain.create({
        data: { name, createdById: req.user!.id },
      });

      res.status(201).json({ domain });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(400).json({ error: "Failed to create domain" });
    }
  },
);

// DELETE /api/domains/:id — delete domain
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const result = await prisma.domain.deleteMany({
        where: { id: req.params.id },
      });

      if (result.count === 0) {
        return res.status(404).json({ error: "Domain not found" });
      }

      res.json({ message: "Domain deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete domain" });
    }
  },
);

export default router;
