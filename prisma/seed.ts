import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  // seed partners
  const pfizer = await prisma.partner.create({
      data: {
           name: 'Pfizer',
       }
  });
  const genentech = await prisma.partner.create({
    data: {
        name: 'Genentech',
    }
  });
  const gsk = await prisma.partner.create({
    data: {
        name: 'GSK',
    }
  });
  const eliLilly = await prisma.partner.create({
    data: {
        name: 'Eli Lilly',
    }
  });

  // seed categories
  const cancer = await prisma.category.create({
    data: {
        name: 'Cancer',
        assignedPartnerId: pfizer.id
    }
  });
  const diabetes = await prisma.category.create({
    data: {
        name: 'Diabetes',
        assignedPartnerId: eliLilly.id
    }
  });
}
main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })