import { LoginDTO } from "./dto/login.dto.js";
import { RegisterDTO, VerificationDTO } from "./dto/register.dto.js";
import { ApiError } from "../../utils/api-error.js";
import { PasswordService } from "./password.service.js";
import { TokenService } from "./token.service.js";
import { PrismaClient } from "../../../generated/prisma/client.js";
import { MailService } from "../mail/mail.service.js";
import {
  BASE_URL_FE,
  JWT_SECRET,
  JWT_SECRET_KEY_RESET_PASSWORD,
  JWT_SECRET_KEY_VERIFICATION,
} from "../../config/env.js";
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
    if (!existingUser.password) {
      throw new ApiError("User Account is not activated", 400);
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
    const { email, firstName, lastName, phoneNumber, userName } = body;

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, ...(phoneNumber ? [{ phoneNumber }] : [])],
      },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        password: true,
        accountStatus: true,
        verificationSentAt: true,
      },
    });

    if (existingUser) {
      if (
        existingUser.email === email &&
        existingUser.accountStatus === "PENDING" &&
        !existingUser.password
      ) {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        if (
          existingUser.verificationSentAt &&
          existingUser.verificationSentAt > fifteenMinutesAgo
        ) {
          throw new ApiError(
            "Verification email was recently sent. Please check your inbox.",
            400,
          );
        }

        const verificationPayload = {
          id: existingUser.id,
          email: existingUser.email,
        };
        const emailVerificationToken = this.tokenService.generateToken(
          verificationPayload,
          JWT_SECRET_KEY_VERIFICATION,
          { expiresIn: "15m" },
        );

        const verificationLink = `${BASE_URL_FE}/register/set-password?token=${emailVerificationToken}`;

        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            firstName,
            lastName,
            phoneNumber,
            userName,
            verificationSentAt: new Date(),
          },
        });

        await this.mailService.sendVerificationEmail(
          existingUser.email,
          verificationLink,
          firstName,
        );

        return existingUser;
      }

      if (existingUser.email === email) {
        throw new ApiError("Email already exist", 400);
      }
      if (existingUser.phoneNumber === phoneNumber) {
        throw new ApiError("Phone number already exist", 400);
      }
    }

    const newUser = await this.prisma.user.create({
      data: {
        email,
        userName,
        firstName,
        lastName,
        phoneNumber,
      },
    });

    const verificationPayload = {
      id: newUser.id,
      email: newUser.email,
    };
    const emailVerificationToken = this.tokenService.generateToken(
      verificationPayload,
      JWT_SECRET_KEY_VERIFICATION,
      { expiresIn: "15m" },
    );

    const verificationLink = `${BASE_URL_FE}/register/set-password?token=${emailVerificationToken}`;

    await this.mailService.sendVerificationEmail(
      newUser.email,
      verificationLink,
      newUser.firstName,
    );

    await this.prisma.user.update({
      where: { id: newUser.id },
      data: {
        verificationSentAt: new Date(),
      },
    });

    return newUser;
  };

  verifyEmailAndSetPassword = async (
    authUserId: number,
    body: VerificationDTO,
  ) => {
    const { password } = body;

    const existingUser = await this.prisma.user.findUnique({
      where: { id: authUserId },
      select: {
        id: true,
        password: true,
        accountStatus: true,
      },
    });

    if (!existingUser) {
      throw new ApiError("Invalid user/token", 400);
    }

    if (existingUser.password) {
      throw new ApiError("Account already verified", 400);
    }

    const hashedPassword = await this.passwordService.hashPassword(password);
    const updatedUser = await this.prisma.user.update({
      where: { id: authUserId },
      data: {
        password: hashedPassword,
        accountStatus: "ACTIVE",
      },
    });

    return updatedUser;
  };

  changePassword = async (authUserId: number, body: ChangePasswordDTO) => {
    const { currentPassword, newPassword } = body;

    const existingUser = await this.prisma.user.findFirst({
      where: { id: authUserId },
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
      where: { id: authUserId },
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
