import fs from "fs/promises";
import handlebars from "handlebars";
import nodemailer, { Transporter } from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";
import { MAIL_PASSWORD, MAIL_USER } from "../../config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type OrderCreatedRow = {
  no: number;
  productName: string;
  sku: string;
  materialName: string;
  materialSku: string;
  components: string;
  basePrice: string;
  materialPrice: string;
  componentPrice: string;
  itemTotalPrice: string;
};

type OrderCreatedEmailContext = {
  firstName: string;
  orderNumber: string;
  orderId: string;
  orderStatus: string;
  createdAt: string;
  deliveryType: string;
  deliveryDistance: string;
  totalWeight: string;
  addressLines: string[];
  notes: string;
  previewUrl: string | null;
  productRows: OrderCreatedRow[];
  subtotalPrice: string;
  deliveryFee: string;
  grandTotalPrice: string;
};

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

  public sendVerificationEmail = async (
    to: string,
    verificationLink: string,
    firstName: string,
  ): Promise<void> => {
    await this.sendEmail(to, "Email Verification", "verif-email", {
      verificationLink,
      firstName,
    });
  };

  public sendResetPasswordEmail = async (
    to: string,
    resetPasswordLink: string,
    firstName: string,
  ): Promise<void> => {
    await this.sendEmail(to, "Reset Password", "reset-password", {
      resetPasswordLink,
      firstName,
    });
  };

  public sendRequestDeleteAccountEmail = async (
    to: string,
    deleteAccountLink: string,
    firstName: string,
  ): Promise<void> => {
    await this.sendEmail(to, "Delete Account", "delete-account-request", {
      deleteAccountLink,
      firstName,
    });
  };

  public sendGoodByeEmail = async (
    to: string,
    firstName: string,
  ): Promise<void> => {
    await this.sendEmail(to, "Goodbye from Byte Beyond Persona", "good-bye", {
      firstName,
    });
  };

  public sendSuccessfulOrderCreation = async (
    to: string,
    context: OrderCreatedEmailContext,
  ): Promise<void> => {
    await this.sendEmail(to, "Order Created", "order-created", context);
  };
}
