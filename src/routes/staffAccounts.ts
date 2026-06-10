import express from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const router = express.Router();

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

const createStaffAccountSchema = z.object({
  fullName: z.string().min(1),
  emailPrefix: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9._-]+$/, {
      message:
        "Email prefix can only contain letters, numbers, dots, hyphens, underscores",
    }),
  domainId: z.string().uuid(),
  department: z.string().min(1),
  temporaryPassword: z.string().min(6),
});

// GET /api/staff-accounts — list all staff accounts
router.get(
  "/",
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const staffAccounts = await prisma.staffAccount.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          domain: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      res.json({ staffAccounts });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch staff accounts" });
    }
  },
);

// GET /api/staff-accounts/:id — get single staff account
router.get(
  "/:id",
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const staffAccount = await prisma.staffAccount.findUnique({
        where: { id: req.params.id },
        include: {
          domain: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      if (!staffAccount) {
        return res.status(404).json({ error: "Staff account not found" });
      }

      res.json({ staffAccount });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch staff account" });
    }
  },
);

// GET /api/staff-accounts/:id/credentials — get credentials for copy button
router.get(
  "/:id/credentials",
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const staffAccount = await prisma.staffAccount.findUnique({
        where: { id: req.params.id },
        include: { domain: { select: { name: true } } },
      });

      if (!staffAccount) {
        return res.status(404).json({ error: "Staff account not found" });
      }

      res.json({
        credentials: {
          email: staffAccount.email,
          temporaryPassword: staffAccount.temporaryPassword,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch credentials" });
    }
  },
);

// POST /api/staff-accounts — create staff account
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const { fullName, emailPrefix, domainId, department, temporaryPassword } =
        createStaffAccountSchema.parse(req.body);

      const domain = await prisma.domain.findUnique({
        where: { id: domainId },
      });
      if (!domain) {
        return res.status(404).json({ error: "Domain not found" });
      }

      const email = `${emailPrefix}@${domain.name}`;

      const existing = await prisma.staffAccount.findUnique({
        where: { email },
      });
      if (existing) {
        return res.status(409).json({ error: "Email address already exists" });
      }

      const staffAccount = await prisma.staffAccount.create({
        data: {
          fullName,
          email,
          department,
          temporaryPassword,
          domainId,
          createdById: req.user!.id,
        },
        include: {
          domain: { select: { id: true, name: true } },
        },
      });

      res.status(201).json({ staffAccount });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(400).json({ error: "Failed to create staff account" });
    }
  },
);

// PATCH /api/staff-accounts/:id/status — update status (INVITED, ACTIVE, SUSPENDED)
router.patch(
  "/:id/status",
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const { status } = z
        .object({ status: z.enum(["INVITED", "ACTIVE", "SUSPENDED"]) })
        .parse(req.body);

      const existing = await prisma.staffAccount.findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        return res.status(404).json({ error: "Staff account not found" });
      }

      const staffAccount = await prisma.staffAccount.update({
        where: { id: req.params.id },
        data: { status },
      });

      res.json({ staffAccount });
    } catch (error) {
      res.status(400).json({ error: "Failed to update status" });
    }
  },
);

// DELETE /api/staff-accounts/:id — delete staff account
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const result = await prisma.staffAccount.deleteMany({
        where: { id: req.params.id },
      });

      if (result.count === 0) {
        return res.status(404).json({ error: "Staff account not found" });
      }

      res.json({ message: "Staff account deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete staff account" });
    }
  },
);

export default router;
