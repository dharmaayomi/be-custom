import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const { Pool } = pg;
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Start seeding products...");

  const products = [
    {
      productName: "Industrial Steel Wardrobe",
      sku: "WRD-IND-001",
      productUrl:
        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb",
      description:
        "Lemari pakaian kokoh dengan rangka baja dan finishing matte.",
      basePrice: 3500000,
      width: 150,
      height: 210,
      depth: 65,
      weight: 85,
      images: [
        "https://picsum.photos/id/20/800/600.jpg",
        "https://picsum.photos/id/21/800/600.jpg",
      ],
      isActive: true,
      isCustomizable: true,
    },
    {
      productName: "Scandinavian Oak Table",
      sku: "TBL-SCA-002",
      productUrl:
        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/SheenChair/glTF-Binary/SheenChair.glb",
      description:
        "Meja makan minimalis berbahan kayu ek (oak) asli dengan tekstur alami.",
      basePrice: 4200000,
      width: 180,
      height: 75,
      depth: 90,
      weight: 45,
      images: ["https://picsum.photos/id/42/800/600.jpg"],
      isActive: true,
      isCustomizable: true,
    },
    {
      productName: "Luxury Velvet Sofa",
      sku: "SFA-LUX-003",
      productUrl:
        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb",
      description:
        "Sofa 3 dudukan dengan kain velvet premium dan busa high-density.",
      basePrice: 8900000,
      width: 220,
      height: 85,
      depth: 100,
      weight: 70,
      images: ["https://picsum.photos/id/100/800/600.jpg"],
      isActive: true,
      isCustomizable: true,
    },
    {
      productName: "Floating Bookshelf",
      sku: "BSH-FLT-004",
      productUrl:
        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Lantern/glTF-Binary/Lantern.glb",
      description: "Rak buku gantung minimalis untuk ruang kerja yang rapi.",
      basePrice: 1200000,
      width: 100,
      height: 30,
      depth: 25,
      weight: 12,
      images: ["https://picsum.photos/id/110/800/600.jpg"],
      isActive: true,
      isCustomizable: true,
    },
    {
      productName: "Ergonomic Office Chair",
      sku: "CHR-ERG-005",
      productUrl: "https://modelviewer.dev/shared-assets/models/Astronaut.glb",
      description:
        "Kursi kantor dengan dukungan lumbal yang dapat disesuaikan.",
      basePrice: 2850000,
      width: 65,
      height: 120,
      depth: 65,
      weight: 18,
      images: ["https://picsum.photos/id/119/800/600.jpg"],
      isActive: true,
      isCustomizable: true,
    },
    {
      productName: "Minimalist Bed Frame",
      sku: "BED-MIN-006",
      productUrl:
        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb",
      description:
        "Rangka tempat tidur kayu solid tanpa headboard untuk kesan luas.",
      basePrice: 5000000,
      width: 180,
      height: 35,
      depth: 200,
      weight: 60,
      images: ["https://picsum.photos/id/124/800/600.jpg"],
      isActive: true,
      isCustomizable: true,
    },
    {
      productName: "Marble Coffee Table",
      sku: "TBL-MAR-007",
      productUrl:
        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/SheenChair/glTF-Binary/SheenChair.glb",
      description:
        "Meja kopi dengan top marmer Carrara dan kaki stainless steel.",
      basePrice: 3200000,
      width: 80,
      height: 45,
      depth: 80,
      weight: 35,
      images: ["https://picsum.photos/id/133/800/600.jpg"],
      isActive: true,
      isCustomizable: true,
    },
    {
      productName: "Modern TV Console",
      sku: "CON-TV-008",
      productUrl:
        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb",
      description: "Unit hiburan dengan banyak laci dan jalur manajemen kabel.",
      basePrice: 2400000,
      width: 200,
      height: 50,
      depth: 40,
      weight: 40,
      images: ["https://picsum.photos/id/145/800/600.jpg"],
      isActive: true,
      isCustomizable: true,
    },
    {
      productName: "Retro Armchair",
      sku: "CHR-RET-009",
      productUrl:
        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/SheenChair/glTF-Binary/SheenChair.glb",
      description: "Kursi santai dengan gaya 1950-an, warna oranye burnt.",
      basePrice: 1750000,
      width: 75,
      height: 85,
      depth: 80,
      weight: 22,
      images: ["https://picsum.photos/id/152/800/600.jpg"],
      isActive: true,
      isCustomizable: true,
    },
    {
      productName: "Glass Kitchen Cabinet",
      sku: "KTC-GLS-010",
      productUrl:
        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Lantern/glTF-Binary/Lantern.glb",
      description: "Lemari dapur atas dengan pintu kaca tempered.",
      basePrice: 1900000,
      width: 80,
      height: 70,
      depth: 35,
      weight: 25,
      images: ["https://picsum.photos/id/160/800/600.jpg"],
      isActive: true,
      isCustomizable: true,
    },
    {
      productName: "Rustic Nightstand",
      sku: "NST-RUS-011",
      productUrl:
        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb",
      description:
        "Meja samping tempat tidur dengan tekstur kayu kasar yang unik.",
      basePrice: 850000,
      width: 45,
      height: 55,
      depth: 40,
      weight: 10,
      images: ["https://picsum.photos/id/175/800/600.jpg"],
      isActive: true,
      isCustomizable: true,
    },
    {
      productName: "Executive Glass Desk",
      sku: "DSK-EXE-012",
      productUrl:
        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb",
      description:
        "Meja direktur dengan permukaan kaca tebal dan laci terkunci.",
      basePrice: 7500000,
      width: 200,
      height: 75,
      depth: 90,
      weight: 95,
      images: ["https://picsum.photos/id/180/800/600.jpg"],
      isActive: true,
      isCustomizable: true,
    },
    {
      productName: "Folding Dining Chair",
      sku: "CHR-FLD-013",
      productUrl:
        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb",
      description: "Kursi makan lipat kayu jati, praktis untuk penyimpanan.",
      basePrice: 450000,
      width: 45,
      height: 80,
      depth: 50,
      weight: 6,
      images: ["https://picsum.photos/id/192/800/600.jpg"],
      isActive: true,
      isCustomizable: true,
    },
    {
      productName: "Shoe Storage Bench",
      sku: "BNC-SHU-014",
      productUrl:
        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Lantern/glTF-Binary/Lantern.glb",
      description: "Bangku duduk di pintu masuk dengan rak sepatu di bawahnya.",
      basePrice: 1100000,
      width: 120,
      height: 45,
      depth: 35,
      weight: 15,
      images: ["https://picsum.photos/id/201/800/600.jpg"],
      isActive: true,
      isCustomizable: true,
    },
    {
      productName: "Tall Display Case",
      sku: "DSP-TLL-015",
      productUrl:
        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb",
      description: "Lemari pajangan tinggi dengan lampu spotlight internal.",
      basePrice: 4800000,
      width: 60,
      height: 190,
      depth: 40,
      weight: 55,
      images: ["https://picsum.photos/id/211/800/600.jpg"],
      isActive: true,
      isCustomizable: true,
    },
  ];

  for (const product of products) {
    await prisma.productBase.create({
      data: product,
    });
  }

  console.log("--- Seeding Selesai: 15 Produk Berhasil Ditambahkan ---");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
