import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, MaterialCategory } from "../generated/prisma/client.js";

const { Pool } = pg;
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Start seeding product materials...");

  const materials = [
    // FURNITURE CATEGORY
    {
      materialName: "Polished Oak Wood",
      materialUrl:
        "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/polished_concrete/polished_concrete_diff_1k.jpg",
      materialDesc: "Tekstur kayu ek halus dengan urat kayu alami yang elegan.",
      materialImageUrls: ["https://picsum.photos/id/10/800/600.jpg"],
      materialCategory: MaterialCategory.FURNITURE,
      price: 250000,
      isActive: true,
    },
    {
      materialName: "Brushed Stainless Steel",
      materialUrl:
        "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/metal_plate/metal_plate_diff_1k.jpg",
      materialDesc:
        "Logam stainless steel dengan efek brushed untuk kesan industrial.",
      materialImageUrls: ["https://picsum.photos/id/11/800/600.jpg"],
      materialCategory: MaterialCategory.FURNITURE,
      price: 450000,
      isActive: true,
    },
    {
      materialName: "Midnight Velvet Fabric",
      materialUrl:
        "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/fabric_pattern_07/fabric_pattern_07_col_1k.jpg",
      materialDesc: "Kain velvet lembut berwarna biru tua untuk pelapis sofa.",
      materialImageUrls: ["https://picsum.photos/id/12/800/600.jpg"],
      materialCategory: MaterialCategory.FURNITURE,
      price: 150000,
      isActive: true,
    },
    {
      materialName: "Cognac Leather",
      materialUrl:
        "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/leather_red_02/leather_red_02_coll1_1k.jpg",
      materialDesc:
        "Kulit asli premium dengan warna cokelat cognac yang mewah.",
      materialImageUrls: ["https://picsum.photos/id/13/800/600.jpg"],
      materialCategory: MaterialCategory.FURNITURE,
      price: 800000,
      isActive: true,
    },
    {
      materialName: "White Carrara Marble",
      materialUrl:
        "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/marble_01/marble_01_diff_1k.jpg",
      materialDesc: "Marmer putih dengan urat abu-abu lembut untuk top table.",
      materialImageUrls: ["https://picsum.photos/id/14/800/600.jpg"],
      materialCategory: MaterialCategory.FURNITURE,
      price: 1200000,
      isActive: true,
    },

    // FLOOR CATEGORY
    {
      materialName: "Dark Walnut Parquet",
      materialUrl:
        "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_plank_02/wood_plank_02_diff_1k.jpg",
      materialDesc: "Lantai parket kayu walnut gelap dengan pola linear.",
      materialImageUrls: ["https://picsum.photos/id/15/800/600.jpg"],
      materialCategory: MaterialCategory.FLOOR,
      price: 350000,
      isActive: true,
    },
    {
      materialName: "Grey Concrete Screed",
      materialUrl:
        "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/concrete_floor_worn/concrete_floor_worn_diff_1k.jpg",
      materialDesc: "Lantai semen ekspos abu-abu untuk gaya minimalis modern.",
      materialImageUrls: ["https://picsum.photos/id/16/800/600.jpg"],
      materialCategory: MaterialCategory.FLOOR,
      price: 200000,
      isActive: true,
    },
    {
      materialName: "Terrazzo Speckled Tile",
      materialUrl:
        "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/terrazzo_01/terrazzo_01_diff_1k.jpg",
      materialDesc: "Lantai terrazzo dengan bintik warna-warni yang estetik.",
      materialImageUrls: ["https://picsum.photos/id/17/800/600.jpg"],
      materialCategory: MaterialCategory.FLOOR,
      price: 550000,
      isActive: true,
    },
    {
      materialName: "Black Slate Stone",
      materialUrl:
        "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floor_stone_6/floor_stone_6_diff_1k.jpg",
      materialDesc:
        "Batu alam slate hitam yang memberikan kesan kokoh dan dingin.",
      materialImageUrls: ["https://picsum.photos/id/18/800/600.jpg"],
      materialCategory: MaterialCategory.FLOOR,
      price: 400000,
      isActive: true,
    },
    {
      materialName: "Classic Red Brick Floor",
      materialUrl:
        "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brick_floor_002/brick_floor_002_diff_1k.jpg",
      materialDesc: "Lantai bata merah klasik untuk area semi-outdoor.",
      materialImageUrls: ["https://picsum.photos/id/19/800/600.jpg"],
      materialCategory: MaterialCategory.FLOOR,
      price: 180000,
      isActive: true,
    },

    // WALL CATEGORY
    {
      materialName: "Exposed Red Brick Wall",
      materialUrl:
        "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/castle_brick_02/castle_brick_02_diff_1k.jpg",
      materialDesc: "Dinding bata merah ekspos untuk kesan rustic.",
      materialImageUrls: ["https://picsum.photos/id/20/800/600.jpg"],
      materialCategory: MaterialCategory.WALL,
      price: 220000,
      isActive: true,
    },
    {
      materialName: "Beige Plaster Wall",
      materialUrl:
        "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/plaster_grey_04/plaster_grey_04_diff_1k.jpg",
      materialDesc:
        "Dinding semen plaster dengan warna beige yang menenangkan.",
      materialImageUrls: ["https://picsum.photos/id/21/800/600.jpg"],
      materialCategory: MaterialCategory.WALL,
      price: 130000,
      isActive: true,
    },
    {
      materialName: "Vertical Wood Slat Wall",
      materialUrl:
        "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_plank_02/wood_plank_02_diff_1k.jpg",
      materialDesc: "Panel dinding kayu vertikal untuk aksen ruangan.",
      materialImageUrls: ["https://picsum.photos/id/22/800/600.jpg"],
      materialCategory: MaterialCategory.WALL,
      price: 600000,
      isActive: true,
    },
    {
      materialName: "Subway White Tile",
      materialUrl:
        "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/square_floor/square_floor_diff_1k.jpg",
      materialDesc:
        "Keramik dinding putih glossy, cocok untuk dapur/backsplash.",
      materialImageUrls: ["https://picsum.photos/id/23/800/600.jpg"],
      materialCategory: MaterialCategory.WALL,
      price: 300000,
      isActive: true,
    },
    {
      materialName: "Dark Charcoal Paint",
      materialUrl:
        "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/denim_fabric/denim_fabric_diff_1k.jpg",
      materialDesc: "Cat dinding warna charcoal gelap dengan finishing matte.",
      materialImageUrls: ["https://picsum.photos/id/25/800/600.jpg"],
      materialCategory: MaterialCategory.WALL,
      price: 95000,
      isActive: true,
    },
  ];

  for (const material of materials) {
    await prisma.productMaterials.create({
      data: material,
    });
  }

  console.log(
    `--- Seeding Selesai: ${materials.length} Material Berhasil Ditambahkan ---`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
