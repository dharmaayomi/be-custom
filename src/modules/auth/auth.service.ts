import { LoginDTO } from "./dto/login.dto.js";
import { RegisterDTO } from "./dto/register.dto.js";
import { ApiError } from "../../utils/api-error.js";
import { PasswordService } from "./password.service.js";
import { TokenService } from "./token.service.js";
import { PrismaClient } from "../../../generated/prisma/client.js";
import { MailService } from "../mail/mail.service.js";
import { JWT_SECRET, JWT_SECRET_KEY_RESET_PASSWORD } from "../../config/env.js";
import { ChangePasswordDTO } from "./dto/changePassword.dto.js";
import { ResetPasswordDTO } from "./dto/resetPassword.dto.js";
import { ForgotPasswordDTO } from "./dto/forgotPassword.dto.js";

export class AuthService {
  constructor(
    private prisma: PrismaClient,
    private passwordService: PasswordService,
    private tokenService: TokenService,
    private mailService: MailService,
  ) {}

  login = async (body: LoginDTO) => {
    const { email, password } = body;

    const existingUser = await this.prisma.user.findFirst({
      where: { email },
    });

    if (!existingUser) {
      throw new ApiError("User not found", 404);
    }

    const isPasswordValid = await this.passwordService.comparePassword(
      password,
      existingUser.password,
    );

    if (!isPasswordValid) {
      throw new ApiError("Invalid credentials", 400);
    }

    const accessToken = this.tokenService.generateToken(
      {
        id: existingUser.id,
        role: existingUser.role,
      },
      JWT_SECRET,
    );

    const { password: pw, ...userWithoutPassword } = existingUser;

    return { ...userWithoutPassword, accessToken };
  };

  register = async (body: RegisterDTO) => {
    const { email, password, firstName, lastName, phoneNumber, userName } =
      body;

    const existingUser = await this.prisma.user.findFirst({
      where: { email },
    });

    if (existingUser) {
      throw new ApiError("Email already exist", 400);
    }

    const hashedPassword = await this.passwordService.hashPassword(password);

    const newUser = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        userName,
        firstName,
        lastName,
        phoneNumber,
      },
    });

    await this.mailService.sendEmail(
      newUser.email,
      "Welcome to Byte Beyond Persona",
      "new-registration",
      { firstName: newUser.firstName },
    );
    const { password: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  };

  changePassword = async (userId: number, body: ChangePasswordDTO) => {
    const { currentPassword, newPassword } = body;

    const existingUser = await this.prisma.user.findFirst({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!existingUser || !existingUser.password) {
      throw new ApiError("Invalid user", 400);
    }

    const isPasswordValid = await this.passwordService.comparePassword(
      currentPassword,
      existingUser.password,
    );
    if (!isPasswordValid) {
      throw new ApiError("Current password incorrect", 400);
    }

    const isPasswordSame = await this.passwordService.comparePassword(
      newPassword,
      existingUser.password,
    );
    if (isPasswordSame) {
      throw new ApiError("New password should be different", 400);
    }

    const hashedPassword = await this.passwordService.hashPassword(newPassword);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
    const { password, ...userWithoutPassword } = updatedUser;

    return userWithoutPassword;
  };

  forgotPassword = async (body: ForgotPasswordDTO) => {
    const { email } = body;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
      },
    });

    if (!existingUser) {
      throw new ApiError("Email is not registered", 400);
    }

    const forgotPasswordPayload = {
      userId: existingUser.id,
      email: existingUser.email,
    };

    const resetPasswordToken = this.tokenService.generateToken(
      forgotPasswordPayload,
      JWT_SECRET_KEY_RESET_PASSWORD,
      { expiresIn: "15m" },
    );

    await this.prisma.user.update({
      where: { id: existingUser.id },
      data: {
        resetPasswordToken: resetPasswordToken,
        resetPasswordTokenUsed: false,
      },
    });

    const resetPasswordLink = `${process.env.BASE_URL_FE}/reset-password?token=${resetPasswordToken}`;

    await this.mailService.sendResetPasswordEmail(
      existingUser.email,
      resetPasswordLink,
      existingUser.firstName,
    );

    return {
      message: "Reset password link has been sent to your email",
    };
  };

  resetPassword = async (
    body: ResetPasswordDTO,
    resetPasswordToken: string,
  ) => {
    try {
      this.tokenService.verifyToken(
        resetPasswordToken,
        JWT_SECRET_KEY_RESET_PASSWORD,
      );
    } catch (error) {
      throw new ApiError("Invalid reset password token", 400);
    }

    const { newPassword } = body;
    const existingUser = await this.prisma.user.findFirst({
      where: { resetPasswordToken, resetPasswordTokenUsed: false },
      select: { id: true },
    });

    if (!existingUser) {
      throw new ApiError("Invalid reset password token", 400);
    }

    const hashedPassword = await this.passwordService.hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: existingUser.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordTokenUsed: true,
      },
    });
    return {
      message: "Password reset successfully",
    };
  };
}
