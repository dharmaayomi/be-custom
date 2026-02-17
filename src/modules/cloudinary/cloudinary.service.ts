import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import {
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_CLOUD_NAME,
} from "../../config/env.js";
import { Readable } from "stream";

export class CloudinaryService {
  constructor() {
    cloudinary.config({
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      cloud_name: CLOUDINARY_CLOUD_NAME,
    });
  }

  private bufferToStream = (buffer: Buffer): Readable => {
    const readable = new Readable();
    readable._read = () => {};
    readable.push(buffer);
    readable.push(null);
    return readable;
  };

  private extractPublicIdFromUrl = (url: string): string => {
    const urlParts = url.split("/");
    const lastPart = urlParts[urlParts.length - 1];
    return lastPart.split(".")[0];
  };

  public upload = (file: Express.Multer.File): Promise<UploadApiResponse> => {
    return new Promise((resolve, reject) => {
      const readableStream = this.bufferToStream(file.buffer);

      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "custom_be" },
        (error, result) => {
          if (error) return reject(error);
          if (!result)
            return reject(
              new Error("Upload failed: No result from Cloudinary"),
            );
          resolve(result);
        },
      );

      readableStream.pipe(uploadStream);
    });
  };

  public getDesignPreviewUploadSignature = (authUserId: number) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `custom_be/designs/${authUserId}`;
    const signature = cloudinary.utils.api_sign_request(
      { folder, timestamp },
      CLOUDINARY_API_SECRET as string,
    );

    return {
      timestamp,
      folder,
      signature,
      apiKey: CLOUDINARY_API_KEY,
      cloudName: CLOUDINARY_CLOUD_NAME,
    };
  };

  public getProductUploadSignature = (
    authUserId: number,
    resourceType: "image" | "raw",
  ) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `custom_be/products/${authUserId}/${resourceType}`;
    const signature = cloudinary.utils.api_sign_request(
      { folder, timestamp },
      CLOUDINARY_API_SECRET as string,
    );

    return {
      timestamp,
      folder,
      signature,
      resourceType,
      apiKey: CLOUDINARY_API_KEY,
      cloudName: CLOUDINARY_CLOUD_NAME,
    };
  };

  public remove = async (secureUrl: string): Promise<any> => {
    try {
      const publicId = this.extractPublicIdFromUrl(secureUrl);
      return await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error("Cloudinary Remove Error:", error);
      throw error;
    }
  };
}
