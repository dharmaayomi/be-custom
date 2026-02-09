import "dotenv/config";

export const PORT = process.env.PORT;
export const DATABASE_URL = process.env.DATABASE_URL;
export const MAIL_USER = process.env.MAIL_USER;
export const MAIL_PASSWORD = process.env.MAIL_PASSWORD;
export const JWT_SECRET = process.env.JWT_SECRET as string;
export const BASE_URL_FE = process.env.BASE_URL_FE;
export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
