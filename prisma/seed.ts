import { PrismaClient, UserRole, ProjectStatus } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Hash password for admin
  const adminPassword = await bcrypt.hash('admin123', 10)

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@vdmanager.com' },
    update: { name: 'Administrateur' },
    create: {
      email: 'admin@vdmanager.com',
      name: 'Administrateur',
      password: adminPassword,
      role: UserRole.ADMIN,
    },
  })

  console.log('Created admin user:', admin.email)

  // Hash password for team member
  const memberPassword = await bcrypt.hash('member123', 10)

  // Create team member user
  const member = await prisma.user.upsert({
    where: { email: 'member@vdmanager.com' },
    update: { name: 'Membre de l\'équipe' },
    create: {
      email: 'member@vdmanager.com',
      name: 'Membre de l\'équipe',
      password: memberPassword,
      role: UserRole.MEMBER,
    },
  })

  console.log('Created team member:', member.email)

  // Create sample announcements
  await prisma.announcement.deleteMany()
  
  const announcement1 = await prisma.announcement.create({
    data: {
      title: 'Bienvenue sur la plateforme VD Manager',
      content: 'Nous sommes ravis de lancer notre nouvelle plateforme interne pour la gestion des projets d\'audiodescription. Restez à l\'écoute pour plus de mises à jour !',
      createdById: admin.id,
    },
  })

  console.log('Created announcement:', announcement1.title)

  const announcement2 = await prisma.announcement.create({
    data: {
      title: 'Nouvelle saison bientôt',
      content: 'La nouvelle saison débutera la semaine prochaine. Veuillez consulter vos projets assignés et les échéances.',
      createdById: admin.id,
    },
  })

  console.log('Created announcement:', announcement2.title)

  // Create sample series for characters database
  const series1 = await prisma.series.upsert({
    where: { name: 'The Crown' },
    update: { description: 'Un drame historique sur le règne de la reine Elizabeth II' },
    create: {
      name: 'The Crown',
      description: 'Un drame historique sur le règne de la reine Elizabeth II',
    },
  })

  console.log('Created series:', series1.name)

  const season1 = await prisma.season.upsert({
    where: {
      seriesId_number: {
        seriesId: series1.id,
        number: 1,
      },
    },
    update: { year: 2016 },
    create: {
      seriesId: series1.id,
      number: 1,
      year: 2016,
    },
  })

  console.log('Created season:', season1.number)

  // Add sample characters
  await prisma.character.deleteMany({ where: { seasonId: season1.id } })
  
  await prisma.character.createMany({
    data: [
      {
        name: 'Reine Elizabeth II',
        actorName: 'Claire Foy',
        seasonId: season1.id,
      },
      {
        name: 'Prince Philip',
        actorName: 'Matt Smith',
        seasonId: season1.id,
      },
      {
        name: 'Princesse Margaret',
        actorName: 'Vanessa Kirby',
        seasonId: season1.id,
      },
    ],
  })

  console.log('Created sample characters')

  // Create sample projects for the team member
  await prisma.project.deleteMany({ where: { assignedToId: member.id } })
  
  const today = new Date()
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  const twoWeeks = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)

  await prisma.project.createMany({
    data: [
      {
        name: 'Description Épisode 1',
        seriesName: 'The Crown',
        season: 'Saison 1',
        pageCount: 45,
        writingDate: new Date(),
        deadline: nextWeek,
        status: ProjectStatus.IN_PROGRESS,
        progress: 60,
        assignedToId: member.id,
      },
      {
        name: 'Description Épisode 2',
        seriesName: 'The Crown',
        season: 'Saison 1',
        pageCount: 52,
        writingDate: null,
        deadline: twoWeeks,
        status: ProjectStatus.NOT_STARTED,
        progress: 0,
        assignedToId: member.id,
      },
      {
        name: 'Description Épisode 3',
        seriesName: 'The Crown',
        season: 'Saison 1',
        pageCount: 48,
        writingDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
        deadline: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
        status: ProjectStatus.DONE,
        progress: 100,
        assignedToId: member.id,
      },
    ],
  })

  console.log('Created sample projects')
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
