import { PrismaClient } from "../generated/prisma/client.js";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse";
import { fileURLToPath } from "url";
import pg from "pg"; // Tambahkan ini
import { PrismaPg } from "@prisma/adapter-pg"; // Tambahkan ini

// Konfigurasi koneksi menggunakan Driver Adapter
const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }); // Masukkan adapter ke sini

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const csvFilePath = path.resolve(__dirname, "./data/list_dest.csv");

  console.log("🚀 Memulai proses seeding JneDestination...");

  await prisma.jneDestination.deleteMany({});

  const records: any[] = [];
  const parser = fs.createReadStream(csvFilePath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }),
  );

  let totalInserted = 0;

  for await (const record of parser) {
    records.push({
      provinceName: record.PROVINCE_NAME,
      cityName: record.CITY_NAME,
      districtName: record.DISTRICT_NAME,
      subdistrictName: record.SUBDISTRICT_NAME,
      zipCode: record.ZIP_CODE,
      tariffCode: record.TARIFF_CODE,
    });

    if (records.length >= 1000) {
      const batch = records.splice(0, 1000);
      await prisma.jneDestination.createMany({ data: batch });
      totalInserted += batch.length;
      console.log(`▓ Berhasil memasukkan ${totalInserted} data...`);
    }
  }

  if (records.length > 0) {
    totalInserted += records.length;
    await prisma.jneDestination.createMany({ data: records });
  }

  console.log(
    `✅ Seeding selesai! Total ${totalInserted} destinasi dimasukkan.`,
  );
}

main()
  .catch((e) => {
    console.error("❌ Terjadi kesalahan saat seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
