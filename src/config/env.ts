import "dotenv/config";

export const PORT = process.env.PORT;
export const MAIL_USER = process.env.MAIL_USER;
export const MAIL_PASSWORD = process.env.MAIL_PASSWORD;
export const JWT_SECRET = process.env.JWT_SECRET as string;
export const BASE_URL_FE = process.env.BASE_URL_FE;
