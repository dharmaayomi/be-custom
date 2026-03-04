import { PrismaClient } from "../../../generated/prisma/client.js";

export class AdminService {
  constructor(private prisma: PrismaClient) {}
}
