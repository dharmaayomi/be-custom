import { LoginDTO } from "./dto/login.dto.js";
import { RegisterDTO } from "./dto/register.dto.js";
import { ApiError } from "../../utils/api-error.js";
import { PasswordService } from "./password.service.js";
import { TokenService } from "./token.service.js";
import { PrismaClient } from "../../../generated/prisma/client.js";
import { MailService } from "../mail/mail.service.js";
import { JWT_SECRET } from "../../config/env.js";

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
}
