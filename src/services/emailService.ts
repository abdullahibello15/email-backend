import { prisma } from "../config/database.js";
import { createTransporter } from "../config/smtp.js";

export async function sendEmail(emailId: string) {
  try {
    const email = await prisma.email.findUnique({
      where: { id: emailId },
      include: {
        sender: true,
        recipients: true,
        attachments: true,
      },
    });

    if (!email) {
      throw new Error("Email not found");
    }

    const transporter = createTransporter();

    const to = email.recipients
      .filter((r) => r.type === "TO")
      .map((r) => r.email);
    const cc = email.recipients
      .filter((r) => r.type === "CC")
      .map((r) => r.email);
    const bcc = email.recipients
      .filter((r) => r.type === "BCC")
      .map((r) => r.email);

    // Update status to SENDING
    await prisma.email.update({
      where: { id: emailId },
      data: { status: "SENDING" },
    });

    // Send email
    await transporter.sendMail({
      from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
      to: to.join(", "),
      cc: cc.length > 0 ? cc.join(", ") : undefined,
      bcc: bcc.length > 0 ? bcc.join(", ") : undefined,
      subject: email.subject,
      html: email.htmlBody,
      text: email.body,
    });

    // Update status to SENT
    await prisma.email.update({
      where: { id: emailId },
      data: { status: "SENT", sentAt: new Date() },
    });

    console.log(`✅ Email ${emailId} sent successfully`);
    return { success: true };
  } catch (error) {
    console.error("Email send error:", error);

    await prisma.email.update({
      where: { id: emailId },
      data: { status: "FAILED" },
    });

    return { success: false, error };
  }
}

export async function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>,
): Promise<string> {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    result = result.replace(regex, value);
  }
  return result;
}
