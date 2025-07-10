import { PrismaClient } from "../generated/prisma";

interface MetricFilter {
	userFilter?: Record<string, any>;
	startDate?: string | Date;
	endDate?: string | Date;
}

export const METRIC = (prisma: PrismaClient, filter: MetricFilter = {}) => {
	return {
		User: {
			totalUsers: async () =>
				prisma.user.count({
					where: {
						isDeleted: false,
						...(filter.userFilter || {}),
					},
				}),
		},
		Student: {
			totalStudent: async () =>
				prisma.student.count({
					where: {
						isDeleted: false,
						person: {
							users: {
								some: filter.userFilter || {},
							},
						},
					},
				}),
		},
		Anxiety: {
			totalAnxiety: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						assessmentDate: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				return prisma.anxietyAssessment.count({
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
				});
			},

			availableYears: async () => {
				const assessments = await prisma.anxietyAssessment.findMany({
					where: {
						isDeleted: false,
					},
					select: {
						assessmentDate: true,
					},
				});

				const years = new Set<number>();
				assessments.forEach((assessment) => {
					if (assessment.assessmentDate) {
						years.add(assessment.assessmentDate.getFullYear());
					}
				});

				return Array.from(years).sort((a, b) => b - a);
			},

			totalAnxietyByProgram: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						assessmentDate: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				const anxietyWithProgram = await prisma.anxietyAssessment.findMany({
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
					include: {
						user: {
							include: {
								person: {
									include: {
										students: {
											where: { isDeleted: false },
										},
									},
								},
							},
						},
					},
				});

				const programCounts: Record<string, number> = {};
				anxietyWithProgram.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						programCounts[student.program] = (programCounts[student.program] || 0) + 1;
					});
				});

				return Object.entries(programCounts).map(([program, count]) => ({
					program,
					count,
				}));
			},

			totalAnxietyByYear: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						assessmentDate: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				const anxietyWithYear = await prisma.anxietyAssessment.findMany({
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
					include: {
						user: {
							include: {
								person: {
									include: {
										students: {
											where: { isDeleted: false },
										},
									},
								},
							},
						},
					},
				});

				const yearCounts: Record<string, number> = {};
				anxietyWithYear.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						yearCounts[student.year] = (yearCounts[student.year] || 0) + 1;
					});
				});

				return Object.entries(yearCounts).map(([year, count]) => ({
					year,
					count,
				}));
			},

			totalAnxietyByGender: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						assessmentDate: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				const anxietyWithGender = await prisma.anxietyAssessment.findMany({
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
					include: {
						user: {
							include: {
								person: true,
							},
						},
					},
				});

				const genderCounts: Record<string, number> = {};
				anxietyWithGender.forEach((assessment) => {
					const gender = assessment.user.person?.gender || "unknown";
					genderCounts[gender] = (genderCounts[gender] || 0) + 1;
				});

				return Object.entries(genderCounts).map(([gender, count]) => ({
					gender,
					count,
				}));
			},
		},
		Stress: {
			totalStress: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						assessmentDate: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				return prisma.stressAssessment.count({
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
				});
			},

			availableYears: async () => {
				const assessments = await prisma.stressAssessment.findMany({
					where: {
						isDeleted: false,
					},
					select: {
						assessmentDate: true,
					},
				});

				const years = new Set<number>();
				assessments.forEach((assessment) => {
					if (assessment.assessmentDate) {
						years.add(assessment.assessmentDate.getFullYear());
					}
				});

				return Array.from(years).sort((a, b) => b - a);
			},

			totalStressByProgram: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						assessmentDate: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				const stressWithProgram = await prisma.stressAssessment.findMany({
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
					include: {
						user: {
							include: {
								person: {
									include: {
										students: {
											where: { isDeleted: false },
										},
									},
								},
							},
						},
					},
				});

				const programCounts: Record<string, number> = {};
				stressWithProgram.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						programCounts[student.program] = (programCounts[student.program] || 0) + 1;
					});
				});

				return Object.entries(programCounts).map(([program, count]) => ({
					program,
					count,
				}));
			},

			totalStressByYear: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						assessmentDate: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				const stressWithYear = await prisma.stressAssessment.findMany({
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
					include: {
						user: {
							include: {
								person: {
									include: {
										students: {
											where: { isDeleted: false },
										},
									},
								},
							},
						},
					},
				});

				const yearCounts: Record<string, number> = {};
				stressWithYear.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						yearCounts[student.year] = (yearCounts[student.year] || 0) + 1;
					});
				});

				return Object.entries(yearCounts).map(([year, count]) => ({
					year,
					count,
				}));
			},

			totalStressByGender: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						assessmentDate: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				const stressWithGender = await prisma.stressAssessment.findMany({
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
					include: {
						user: {
							include: {
								person: true,
							},
						},
					},
				});

				const genderCounts: Record<string, number> = {};
				stressWithGender.forEach((assessment) => {
					const gender = assessment.user.person?.gender || "unknown";
					genderCounts[gender] = (genderCounts[gender] || 0) + 1;
				});

				return Object.entries(genderCounts).map(([gender, count]) => ({
					gender,
					count,
				}));
			},
		},
		Depression: {
			totalDepression: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						assessmentDate: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				return prisma.depressionAssessment.count({
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
				});
			},

			availableYears: async () => {
				const assessments = await prisma.depressionAssessment.findMany({
					where: {
						isDeleted: false,
					},
					select: {
						assessmentDate: true,
					},
				});

				const years = new Set<number>();
				assessments.forEach((assessment) => {
					if (assessment.assessmentDate) {
						years.add(assessment.assessmentDate.getFullYear());
					}
				});

				return Array.from(years).sort((a, b) => b - a);
			},

			totalDepressionByProgram: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						assessmentDate: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				const depressionWithProgram = await prisma.depressionAssessment.findMany({
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
					include: {
						user: {
							include: {
								person: {
									include: {
										students: {
											where: { isDeleted: false },
										},
									},
								},
							},
						},
					},
				});

				const programCounts: Record<string, number> = {};
				depressionWithProgram.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						programCounts[student.program] = (programCounts[student.program] || 0) + 1;
					});
				});

				return Object.entries(programCounts).map(([program, count]) => ({
					program,
					count,
				}));
			},

			totalDepressionByYear: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						assessmentDate: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				const depressionWithYear = await prisma.depressionAssessment.findMany({
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
					include: {
						user: {
							include: {
								person: {
									include: {
										students: {
											where: { isDeleted: false },
										},
									},
								},
							},
						},
					},
				});

				const yearCounts: Record<string, number> = {};
				depressionWithYear.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						yearCounts[student.year] = (yearCounts[student.year] || 0) + 1;
					});
				});

				return Object.entries(yearCounts).map(([year, count]) => ({
					year,
					count,
				}));
			},

			totalDepressionByGender: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						assessmentDate: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				const depressionWithGender = await prisma.depressionAssessment.findMany({
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
					include: {
						user: {
							include: {
								person: true,
							},
						},
					},
				});

				const genderCounts: Record<string, number> = {};
				depressionWithGender.forEach((assessment) => {
					const gender = assessment.user.person?.gender || "unknown";
					genderCounts[gender] = (genderCounts[gender] || 0) + 1;
				});

				return Object.entries(genderCounts).map(([gender, count]) => ({
					gender,
					count,
				}));
			},
		},
	};
};
