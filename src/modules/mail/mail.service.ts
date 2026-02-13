import fs from "fs/promises";
import handlebars from "handlebars";
import nodemailer, { Transporter } from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";
import { MAIL_PASSWORD, MAIL_USER } from "../../config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MailService {
  private transporter: Transporter;
  private templatesDir: string;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: MAIL_USER,
        pass: MAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    this.templatesDir = path.resolve(__dirname, "./templates");
  }

  private renderTemplate = async (
    templateName: string,
    context: object,
  ): Promise<string> => {
    const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);
    const templateSource = await fs.readFile(templatePath, "utf-8");
    const compiledTemplate = handlebars.compile(templateSource);

    return compiledTemplate(context);
  };

  public sendEmail = async (
    to: string,
    subject: string,
    templateName: string,
    context: object,
  ): Promise<void> => {
    try {
      const html = await this.renderTemplate(templateName, context);
      const mailOptions = {
        from: `"BYTE BEYOND PERSONA" <${MAIL_USER}>`,
        to,
        subject,
        html,
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error: any) {
      throw new Error("Error sending email");
    }
  };

  public sendResetPasswordEmail = async (
    to: string,
    resetPasswordLink: string,
    firstName: string,
  ): Promise<void> => {
    await this.sendEmail(to, "Reset Password", "resetPassword", {
      resetPasswordLink,
      firstName,
    });
  };
}
