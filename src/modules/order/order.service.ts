import { PrismaClient } from "../../../generated/prisma/client.js";

export class OrderService {
  constructor(private prisma: PrismaClient) {}

  createOrder = async (authUserId: number) => {};
}
