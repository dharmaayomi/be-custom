import { NextFunction, Request, Response } from "express";
import { fileTypeFromBuffer } from "file-type";
import { ApiError } from "../utils/api-error.js";
import multer from "multer";

export class UploaderMiddleware {
  uploader(fileLimit: number = 2) {
    const storage = multer.memoryStorage();
    const limits = { fileSize: fileLimit * 1024 * 1024 };

    return multer({ storage, limits });
  }

  async fileFilter(req: Request, _res: Response, next: NextFunction) {
    try {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/avif",
        "image/jpg",
        "image/webp",
        "image/heif",
        "image/heic",
      ];

      const singleFile = req.file;
      if (singleFile) {
        const type = await fileTypeFromBuffer(singleFile.buffer);
        if (!type || !allowedTypes.includes(type.mime)) {
          throw new ApiError(
            `File type ${type?.mime || "unknown"} is not allowed`,
            400,
          );
        }
        return next();
      }

      const files = req.files as
        | { [fieldname: string]: Express.Multer.File[] }
        | undefined;

      if (!files || Object.keys(files).length === 0) {
        return next();
      }

      for (const fieldname in files) {
        const fileArray = files[fieldname];

        for (const file of fileArray) {
          const type = await fileTypeFromBuffer(file.buffer);

          if (!type || !allowedTypes.includes(type.mime)) {
            throw new ApiError(
              `File type ${type?.mime || "unknown"} is not allowed`,
              400,
            );
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  }
}
