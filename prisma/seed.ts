import { PrismaClient, UserRole, JobRole, ProjectStatus, WorkflowStep } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hash = (pw: string) => bcrypt.hash(pw, 10)

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@vdmanager.com' },
    update: {},
    create: {
      email: 'admin@vdmanager.com',
      name: 'Administrateur',
      password: await hash('admin123'),
      role: UserRole.ADMIN,
      jobRole: JobRole.REDACTEUR,
    },
  })

  // Membres équipe (rôles métier variés)
  const outhman = await prisma.user.upsert({
    where: { email: 'outhman@vdmanager.com' },
    update: {},
    create: {
      email: 'outhman@vdmanager.com',
      name: 'Boudarraja Outhman',
      password: await hash('member123'),
      role: UserRole.MEMBER,
      jobRole: JobRole.REDACTEUR,
    },
  })

  const asmaa = await prisma.user.upsert({
    where: { email: 'asmaa@vdmanager.com' },
    update: {},
    create: {
      email: 'asmaa@vdmanager.com',
      name: 'Asmaa',
      password: await hash('member123'),
      role: UserRole.MEMBER,
      jobRole: JobRole.REDACTEUR,
    },
  })

  const driss = await prisma.user.upsert({
    where: { email: 'driss@vdmanager.com' },
    update: {},
    create: {
      email: 'driss@vdmanager.com',
      name: 'Driss BAKKARI',
      password: await hash('member123'),
      role: UserRole.MEMBER,
      jobRole: JobRole.TECH_SON,
    },
  })

  const kawtar = await prisma.user.upsert({
    where: { email: 'kawtar@vdmanager.com' },
    update: {},
    create: {
      email: 'kawtar@vdmanager.com',
      name: 'Kawtar BOUAZZAOUI',
      password: await hash('member123'),
      role: UserRole.MEMBER,
      jobRole: JobRole.NARRATEUR,
    },
  })

  console.log('✅ Users created')

  // Announcements
  await prisma.announcement.deleteMany()
  await prisma.announcement.createMany({
    data: [
      {
        title: 'Bienvenue sur la nouvelle plateforme VDM',
        content: 'La plateforme a été entièrement repensée. Vous pouvez maintenant pointer votre présence, suivre vos projets et consulter vos performances.',
        createdById: admin.id,
      },
      {
        title: 'Rappel : délais semaine du 24 mars',
        content: 'Plusieurs projets arrivent à échéance cette semaine. Merci de mettre à jour vos statuts et d\'indiquer le nombre de pages traitées.',
        createdById: admin.id,
      },
    ],
  })
  console.log('✅ Announcements created')

  // Sample projects
  await prisma.project.deleteMany()
  const today = new Date()
  const d = (days: number) => new Date(today.getTime() + days * 86400000)

  await prisma.project.createMany({
    data: [
      {
        name: 'Elsbeth S2E20',
        seriesName: 'Elsbeth',
        season: '2',
        episodeNumber: '220',
        materialRef: 'G04046',
        workflowStep: WorkflowStep.REDACTION,
        status: ProjectStatus.IN_PROGRESS,
        deadline: d(3),
        redacteurId: outhman.id,
        pageCount: null,
      },
      {
        name: 'CSI Miami S5E17',
        seriesName: 'CSI Miami',
        season: '5',
        episodeNumber: '517',
        materialRef: 'G05234',
        workflowStep: WorkflowStep.REDACTION,
        status: ProjectStatus.NOT_STARTED,
        deadline: d(5),
        redacteurId: asmaa.id,
      },
      {
        name: 'Le bloc S17E38',
        seriesName: 'Le bloc',
        season: '17',
        episodeNumber: '1738',
        materialRef: 'G04966',
        workflowStep: WorkflowStep.MIXAGE,
        status: ProjectStatus.IN_PROGRESS,
        deadline: d(2),
        redacteurId: outhman.id,
        techSonId: driss.id,
        narratorId: kawtar.id,
        pageCount: 12,
        writingDate: d(-3),
      },
      {
        name: 'The Walking Dead Dead City S1E5',
        seriesName: 'The Walking Dead Dead City',
        season: '1',
        episodeNumber: '5',
        materialRef: 'G01640',
        workflowStep: WorkflowStep.TERMINE,
        status: ProjectStatus.DONE,
        deadline: d(-1),
        redacteurId: asmaa.id,
        techSonId: driss.id,
        pageCount: 15,
        writingDate: d(-10),
        mixingDate: d(-2),
        durationMin: 52.5,
      },
    ],
  })
  console.log('✅ Projects created')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
