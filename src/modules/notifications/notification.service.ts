import { PrismaClient, Role } from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { PaginationQueryParams } from "../pagination/dto/pagination.dto.js";
import { PaginationService } from "../pagination/pagination.service.js";

export class NotificationService {
  private paginationService = new PaginationService();

  constructor(private prisma: PrismaClient) {}

  private getActiveUserRole = async (authUserId: number): Promise<Role> => {
    const user = await this.prisma.user.findUnique({
      where: { id: authUserId },
      select: {
        role: true,
        deletedAt: true,
        accountStatus: true,
      },
    });

    if (!user || user.deletedAt || user.accountStatus !== "ACTIVE") {
      throw new ApiError("We couldn't find your account", 404);
    }

    return user.role;
  };

  createNotification = async (params: {
    title: string;
    message: string;
    role: Role;
    targetUserId?: number | null;
  }) => {
    const title = params.title.trim();
    const message = params.message.trim();

    if (!title) {
      throw new ApiError("Notification title is required", 400);
    }
    if (!message) {
      throw new ApiError("Notification message is required", 400);
    }
    if (params.role === Role.USER && !params.targetUserId) {
      throw new ApiError(
        "targetUserId is required for USER notifications",
        400,
      );
    }

    return this.prisma.notification.create({
      data: {
        title,
        message,
        role: params.role,
        targetUserId: params.targetUserId ?? null,
      },
    });
  };

  getNotifications = async (
    authUserId: number,
    query?: PaginationQueryParams,
  ) => {
    const authUserRole = await this.getActiveUserRole(authUserId);
    const page = query?.page ?? 1;
    const perPage = query?.perPage ?? 6;
    const sortBy = query?.sortBy ?? "createdAt";
    const orderBy = query?.orderBy ?? "desc";
    const search = query?.search;
    const skip = (page - 1) * perPage;

    const allowedSortBy = new Set(["id", "title", "createdAt", "updatedAt"]);
    const finalSortBy = allowedSortBy.has(sortBy) ? sortBy : "createdAt";

    const where = {
      OR: [
        { targetUserId: authUserId },
        {
          role: authUserRole,
          targetUserId: null,
        },
      ],
      ...(search?.trim()
        ? {
            OR: [
              {
                title: {
                  contains: search.trim(),
                  mode: "insensitive" as const,
                },
              },
              {
                message: {
                  contains: search.trim(),
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const [count, data] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { [finalSortBy]: orderBy },
      }),
    ]);

    const mappedData = data.map((notification) => ({
      ...notification,
      isRead: notification.readByUserId.includes(authUserId),
    }));

    const unreadCount = await this.prisma.notification.count({
      where: {
        OR: [
          { targetUserId: authUserId },
          {
            role: authUserRole,
            targetUserId: null,
          },
        ],
        NOT: {
          readByUserId: { has: authUserId },
        },
      },
    });

    return {
      data: mappedData,
      unreadCount,
      meta: this.paginationService.generateMeta({
        page,
        perPage,
        count,
      }),
    };
  };

  getUnreadCount = async (authUserId: number) => {
    const authUserRole = await this.getActiveUserRole(authUserId);
    const unreadCount = await this.prisma.notification.count({
      where: {
        OR: [
          { targetUserId: authUserId },
          {
            role: authUserRole,
            targetUserId: null,
          },
        ],
        NOT: {
          readByUserId: { has: authUserId },
        },
      },
    });

    return { unreadCount };
  };

  markAsRead = async (authUserId: number, notificationId: number) => {
    const authUserRole = await this.getActiveUserRole(authUserId);
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        OR: [
          { targetUserId: authUserId },
          {
            role: authUserRole,
            targetUserId: null,
          },
        ],
      },
    });

    if (!notification) {
      throw new ApiError("Notification not found", 404);
    }

    if (notification.readByUserId.includes(authUserId)) {
      return notification;
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        readByUserId: {
          push: authUserId,
        },
      },
    });
  };

  markAllAsRead = async (authUserId: number) => {
    const authUserRole = await this.getActiveUserRole(authUserId);
    const notifications = await this.prisma.notification.findMany({
      where: {
        OR: [
          { targetUserId: authUserId },
          {
            role: authUserRole,
            targetUserId: null,
          },
        ],
        NOT: {
          readByUserId: { has: authUserId },
        },
      },
      select: {
        id: true,
      },
    });

    if (notifications.length === 0) {
      return { updatedCount: 0 };
    }

    const result = await this.prisma.$transaction(
      notifications.map((notification) =>
        this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            readByUserId: {
              push: authUserId,
            },
          },
        }),
      ),
    );

    return { updatedCount: result.length };
  };

  deleteNotification = async (authUserId: number, notificationId: number) => {
    return this.prisma.notification.delete({ where: { id: notificationId } });
  };
}
