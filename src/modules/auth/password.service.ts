import argon2 from "argon2";

export class PasswordService {
  /**
   * Menggunakan arrow function untuk konsistensi dengan
   * pola penulisan method di SampleService Anda.
   */
  hashPassword = async (password: string): Promise<string> => {
    return await argon2.hash(password);
  };

  comparePassword = async (
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> => {
    return await argon2.verify(hashedPassword, plainPassword);
  };
}
