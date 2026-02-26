import "dotenv/config";

export const PORT = process.env.PORT;
export const DATABASE_URL = process.env.DATABASE_URL;
export const MAIL_USER = process.env.MAIL_USER;
export const MAIL_PASSWORD = process.env.MAIL_PASSWORD;
export const JWT_SECRET = process.env.JWT_SECRET as string;
export const JWT_SECRET_KEY_RESET_PASSWORD = process.env
  .JWT_SECRET_KEY_RESET_PASSWORD as string;
export const JWT_SECRET_KEY_VERIFICATION = process.env
  .JWT_SECRET_KEY_VERIFICATION as string;
export const JWT_SECRET_KEY_DELETE_ACCOUNT = process.env
  .JWT_SECRET_KEY_DELETE_ACCOUNT as string;
export const BASE_URL_FE = process.env.BASE_URL_FE;
export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
export const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY as string;
export const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY as string;
export const MIDTRANS_IS_PRODUCTION =
  process.env.MIDTRANS_IS_PRODUCTION === "true";
export const RAJAONGKIR_API_KEY = process.env.RAJAONGKIR_API_KEY as string;
export const RAJAONGKIR_API_DELIVERY_KEY = process.env
  .RAJAONGKIR_API_DELIVERY_KEY as string;
