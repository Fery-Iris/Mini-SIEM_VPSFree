
require("dotenv").config({ path: ".env" });
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashedPassword = await bcrypt.hash("demo1234", 10);
  
  const admin = await prisma.admin.upsert({
    where: { email: "admin@xrsecurity.com" },
    update: {
      password: hashedPassword,
      isVerified: true
    },
    create: {
      email: "admin@xrsecurity.com",
      password: hashedPassword,
      isVerified: true
    }
  });

  console.log("Seeded demo user:", admin.email);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

