import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

async function main() {
	await prisma.user.upsert({
		where: { id: "67c7064d13d130902d5877ca" },
		update: {},
		create: {
			id: "67c7064d13d130902d5877ca",
			email: "maik@sureone.com",
			firstName: "Maik",
			lastName: "Ardan",
			password: "123456",
		},
	});
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
