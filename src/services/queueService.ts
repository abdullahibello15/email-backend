import Bull from "bull";
import { sendEmail } from "./emailService.js";

// Email queue
export const emailQueue = new Bull("email-queue", {
  redis: process.env.REDIS_URL || "redis://localhost:6379",
});

// Add scheduled email job
export async function addScheduledEmailJob(emailId: string, scheduledAt: Date) {
  const delay = scheduledAt.getTime() - Date.now();

  if (delay <= 0) {
    // Send immediately if scheduled time is in the past
    await sendEmail(emailId);
    return;
  }

  await emailQueue.add(
    "send-scheduled-email",
    { emailId },
    {
      delay,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    },
  );

  console.log(`📅 Scheduled email ${emailId} for ${scheduledAt.toISOString()}`);
}

// Add immediate email job
export async function addImmediateEmailJob(emailId: string) {
  await emailQueue.add(
    "send-email",
    { emailId },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    },
  );
}

// Process email queue
export function initializeQueues() {
  emailQueue.process("send-scheduled-email", async (job) => {
    const { emailId } = job.data;
    console.log(`📧 Processing scheduled email: ${emailId}`);
    await sendEmail(emailId);
    return { emailId, status: "sent" };
  });

  emailQueue.process("send-email", async (job) => {
    const { emailId } = job.data;
    console.log(`📧 Processing email: ${emailId}`);
    await sendEmail(emailId);
    return { emailId, status: "sent" };
  });

  emailQueue.on("completed", (job) => {
    console.log(`✅ Job ${job.id} completed`);
  });

  emailQueue.on("failed", (job, err) => {
    console.error(`❌ Job ${job.id} failed:`, err.message);
  });

  console.log("📬 Email queue initialized");
}
