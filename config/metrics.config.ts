import { PrismaClient } from "../generated/prisma";

interface MetricFilter {
	userFilter?: Record<string, any>;
	startDate?: string | Date;
	endDate?: string | Date;
	page?: number;
	limit?: number;
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
					const startDate = new Date(filter.startDate);
					const endDate = filter.endDate ? new Date(filter.endDate) : null;

					dateFilter = {
						assessmentDate: {
							gte: startDate,
							...(endDate && { lte: endDate }),
						},
					};

					console.log(`🔍 API: Anxiety date filter applied`);
					console.log(`📅 Start Date: ${startDate.toISOString()}`);
					if (endDate) console.log(`📅 End Date: ${endDate.toISOString()}`);
				}

				const count = await prisma.anxietyAssessment.count({
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
				});

				console.log(`📊 Anxiety count result: ${count}`);
				return count;
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
					const startDate = new Date(filter.startDate);
					const endDate = filter.endDate ? new Date(filter.endDate) : null;

					dateFilter = {
						assessmentDate: {
							gte: startDate,
							...(endDate && { lte: endDate }),
						},
					};

					console.log(`🔍 API: Anxiety by program date filter applied`);
					console.log(`📅 Start Date: ${startDate.toISOString()}`);
					if (endDate) console.log(`📅 End Date: ${endDate.toISOString()}`);
				}

				const anxietyWithProgram = await prisma.anxietyAssessment.findMany({
					where: {
						isDeleted: false,
						...dateFilter,
						user: {
							isDeleted: false,
							...(filter.userFilter || {}),
						},
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

				console.log(
					`📊 Found ${anxietyWithProgram.length} anxiety assessments with program data`,
				);

				const programCounts: Record<string, number> = {};
				anxietyWithProgram.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						programCounts[student.program] = (programCounts[student.program] || 0) + 1;
					});
				});

				const result = Object.entries(programCounts).map(([program, count]) => ({
					program,
					count,
				}));

				console.log(`📊 Anxiety by program result:`, result);
				return result;
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
					const startDate = new Date(filter.startDate);
					const endDate = filter.endDate ? new Date(filter.endDate) : null;

					dateFilter = {
						assessmentDate: {
							gte: startDate,
							...(endDate && { lte: endDate }),
						},
					};

					console.log(`🔍 API: Stress date filter applied`);
					console.log(`📅 Start Date: ${startDate.toISOString()}`);
					if (endDate) console.log(`📅 End Date: ${endDate.toISOString()}`);
				}

				const count = await prisma.stressAssessment.count({
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
				});

				console.log(`📊 Stress count result: ${count}`);
				return count;
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
					const startDate = new Date(filter.startDate);
					const endDate = filter.endDate ? new Date(filter.endDate) : null;

					dateFilter = {
						assessmentDate: {
							gte: startDate,
							...(endDate && { lte: endDate }),
						},
					};

					console.log(`🔍 API: Depression date filter applied`);
					console.log(`📅 Start Date: ${startDate.toISOString()}`);
					if (endDate) console.log(`📅 End Date: ${endDate.toISOString()}`);
				}

				const count = await prisma.depressionAssessment.count({
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
				});

				console.log(`📊 Depression count result: ${count}`);
				return count;
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
		Suicide: {
			totalSuicide: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					const startDate = new Date(filter.startDate);
					const endDate = filter.endDate ? new Date(filter.endDate) : null;

					dateFilter = {
						assessmentDate: {
							gte: startDate,
							...(endDate && { lte: endDate }),
						},
					};

					console.log(`🔍 API: Suicide date filter applied`);
					console.log(`📅 Start Date: ${startDate.toISOString()}`);
					if (endDate) console.log(`📅 End Date: ${endDate.toISOString()}`);
				}

				const count = await prisma.suicideAssessment.count({
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
				});

				console.log(`📊 Suicide count result: ${count}`);
				return count;
			},

			availableYears: async () => {
				const assessments = await prisma.suicideAssessment.findMany({
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

			totalSuicideByProgram: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					const startDate = new Date(filter.startDate);
					const endDate = filter.endDate ? new Date(filter.endDate) : null;

					dateFilter = {
						assessmentDate: {
							gte: startDate,
							...(endDate && { lte: endDate }),
						},
					};

					console.log(`🔍 API: Suicide by program date filter applied`);
					console.log(`📅 Start Date: ${startDate.toISOString()}`);
					if (endDate) console.log(`📅 End Date: ${endDate.toISOString()}`);
				}

				const suicideWithProgram = await prisma.suicideAssessment.findMany({
					where: {
						isDeleted: false,
						...dateFilter,
						user: {
							isDeleted: false,
							...(filter.userFilter || {}),
						},
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

				console.log(
					`📊 Found ${suicideWithProgram.length} suicide assessments with program data`,
				);

				const programCounts: Record<string, number> = {};
				suicideWithProgram.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						const program = student.program || "Unknown";
						programCounts[program] = (programCounts[program] || 0) + 1;
					});
				});

				const result = Object.entries(programCounts).map(([program, count]) => ({
					program,
					count,
				}));

				console.log(`📊 Suicide by program result:`, result);
				return result;
			},

			totalSuicideByYear: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						assessmentDate: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				const suicideWithYear = await prisma.suicideAssessment.findMany({
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
				suicideWithYear.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						const year = student.year || "Unknown";
						yearCounts[year] = (yearCounts[year] || 0) + 1;
					});
				});

				return Object.entries(yearCounts).map(([year, count]) => ({
					year,
					count,
				}));
			},

			totalSuicideByGender: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						assessmentDate: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				const suicideWithGender = await prisma.suicideAssessment.findMany({
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
				suicideWithGender.forEach((assessment) => {
					const gender = assessment.user.person?.gender || "Unknown";
					genderCounts[gender] = (genderCounts[gender] || 0) + 1;
				});

				return Object.entries(genderCounts).map(([gender, count]) => ({
					gender,
					count,
				}));
			},
		},
		PersonalProblemsChecklist: {
			totalChecklist: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					const startDate = new Date(filter.startDate);
					const endDate = filter.endDate ? new Date(filter.endDate) : null;

					dateFilter = {
						date_completed: {
							gte: startDate,
							...(endDate && { lte: endDate }),
						},
					};

					console.log(`🔍 API: Checklist date filter applied`);
					console.log(`📅 Start Date: ${startDate.toISOString()}`);
					if (endDate) console.log(`📅 End Date: ${endDate.toISOString()}`);
				}

				const count = await prisma.personalProblemsChecklist.count({
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
				});

				console.log(`📊 Checklist count result: ${count}`);
				return count;
			},

			availableYears: async () => {
				const assessments = await prisma.personalProblemsChecklist.findMany({
					where: {
						isDeleted: false,
					},
					select: {
						date_completed: true,
					},
				});

				const years = new Set<number>();
				assessments.forEach((assessment) => {
					if (assessment.date_completed) {
						years.add(new Date(assessment.date_completed).getFullYear());
					}
				});

				return Array.from(years).sort((a, b) => b - a);
			},

			totalChecklistByProgram: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					const startDate = new Date(filter.startDate);
					const endDate = filter.endDate ? new Date(filter.endDate) : null;

					dateFilter = {
						date_completed: {
							gte: startDate,
							...(endDate && { lte: endDate }),
						},
					};

					console.log(`🔍 API: Checklist by program date filter applied`);
					console.log(`📅 Start Date: ${startDate.toISOString()}`);
					if (endDate) console.log(`📅 End Date: ${endDate.toISOString()}`);
				}

				const checklistWithProgram = await prisma.personalProblemsChecklist.findMany({
					where: {
						isDeleted: false,
						...dateFilter,
						user: {
							isDeleted: false,
							...(filter.userFilter || {}),
						},
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

				console.log(
					`📊 Found ${checklistWithProgram.length} checklist assessments with program data`,
				);

				const programCounts: Record<string, number> = {};
				checklistWithProgram.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						const program = student.program || "Unknown";
						programCounts[program] = (programCounts[program] || 0) + 1;
					});
				});

				const result = Object.entries(programCounts).map(([program, count]) => ({
					program,
					count,
				}));

				console.log(`📊 Checklist by program result:`, result);
				return result;
			},

			totalChecklistByYear: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						date_completed: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				const checklistWithYear = await prisma.personalProblemsChecklist.findMany({
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
				checklistWithYear.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						const year = student.year || "Unknown";
						yearCounts[year] = (yearCounts[year] || 0) + 1;
					});
				});

				return Object.entries(yearCounts).map(([year, count]) => ({
					year,
					count,
				}));
			},

			totalChecklistByGender: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						date_completed: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				const checklistWithGender = await prisma.personalProblemsChecklist.findMany({
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
				checklistWithGender.forEach((assessment) => {
					const gender = assessment.user.person?.gender || "Unknown";
					genderCounts[gender] = (genderCounts[gender] || 0) + 1;
				});

				return Object.entries(genderCounts).map(([gender, count]) => ({
					gender,
					count,
				}));
			},
		},
		GuidanceDashboard: {
			studentProgressOverview: async () => {
				console.log(`🔍 API: Getting student progress overview for guidance dashboard`);

				// Extract pagination parameters from filter
				const page = filter?.page ? Number(filter.page) : 1;
				const limit = filter?.limit ? Number(filter.limit) : 10;
				const skip = (page - 1) * limit;

				console.log(`📄 Pagination: page=${page}, limit=${limit}, skip=${skip}`);

				// Get total count of students
				const totalStudents = await prisma.student.count({
					where: { isDeleted: false },
				});

				// Get paginated students with their assessment data
				const students = await prisma.student.findMany({
					where: { isDeleted: false },
					skip,
					take: limit,
					orderBy: [
						{ person: { lastName: "asc" } },
						{ person: { firstName: "asc" } },
					],
					include: {
						person: {
							include: {
								users: {
									where: { type: "student", isDeleted: false },
									include: {
										anxietyAssessments: {
											where: { isDeleted: false },
											orderBy: { assessmentDate: "desc" },
											take: 1,
										},
										stressAssessments: {
											where: { isDeleted: false },
											orderBy: { assessmentDate: "desc" },
											take: 1,
										},
										depressionAssessments: {
											where: { isDeleted: false },
											orderBy: { assessmentDate: "desc" },
											take: 1,
										},
										suicideAssessments: {
											where: { isDeleted: false },
											orderBy: { assessmentDate: "desc" },
											take: 1,
										},
										personalProblemsChecklist: {
											where: { isDeleted: false },
										},
									},
								},
							},
						},
					},
				});

				// Process student data to generate progress insights
				const studentProgressInsights = students
					.map((student) => {
						const user = student.person?.users?.[0];

						// If no user account exists, still include the student but with no assessment data
						if (!user) {
							return {
								studentId: student.id,
								studentName:
									`${student.person?.firstName || ""} ${student.person?.lastName || ""}`.trim(),
								studentNumber: student.studentNumber,
								program: student.program,
								year: student.year,
								totalAssessments: {
									anxiety: 0,
									stress: 0,
									depression: 0,
									suicide: 0,
									checklist: 0,
									overall: 0,
								},
								latestAssessments: {
									anxiety: null,
									stress: null,
									depression: null,
									suicide: null,
									checklist: null,
								},
								progressInsights: [
									{
										type: "warning" as const,
										assessmentType: "overall" as const,
										message: "No user account found for this student.",
										severity: "medium" as const,
										recommendation:
											"Student needs to create a user account to take assessments.",
									},
								],
								riskLevel: "low" as const,
								lastAssessmentDate: null,
							};
						}

						const totalAssessments = {
							anxiety: user.anxietyAssessments.length,
							stress: user.stressAssessments.length,
							depression: user.depressionAssessments.length,
							suicide: user.suicideAssessments.length,
							checklist: user.personalProblemsChecklist ? 1 : 0,
							overall:
								user.anxietyAssessments.length +
								user.stressAssessments.length +
								user.depressionAssessments.length +
								user.suicideAssessments.length +
								(user.personalProblemsChecklist ? 1 : 0),
						};

						const latestAssessments = {
							anxiety: user.anxietyAssessments[0] || null,
							stress: user.stressAssessments[0] || null,
							depression: user.depressionAssessments[0] || null,
							suicide: user.suicideAssessments[0] || null,
							checklist: user.personalProblemsChecklist || null,
						};

						// Generate progress insights
						const progressInsights = [];

						// Check for high severity levels
						if (
							latestAssessments.anxiety &&
							latestAssessments.anxiety.severityLevel === "severe"
						) {
							progressInsights.push({
								type: "warning",
								assessmentType: "anxiety",
								message: `Latest anxiety assessment shows severe levels.`,
								severity: "high",
								recommendation:
									"Please contact your guidance counselor immediately for support.",
							});
						}

						if (
							latestAssessments.stress &&
							latestAssessments.stress.severityLevel === "high"
						) {
							progressInsights.push({
								type: "warning",
								assessmentType: "stress",
								message: `Latest stress assessment shows high levels.`,
								severity: "high",
								recommendation:
									"Please contact your guidance counselor immediately for support.",
							});
						}

						if (
							latestAssessments.depression &&
							latestAssessments.depression.severityLevel === "severe"
						) {
							progressInsights.push({
								type: "warning",
								assessmentType: "depression",
								message: `Latest depression assessment shows severe levels.`,
								severity: "high",
								recommendation:
									"Please contact your guidance counselor immediately for support.",
							});
						}

						if (
							latestAssessments.suicide &&
							latestAssessments.suicide.riskLevel === "high"
						) {
							progressInsights.push({
								type: "warning",
								assessmentType: "suicide",
								message: `Latest suicide risk assessment shows high risk level.`,
								severity: "high",
								recommendation:
									"Please contact your guidance counselor or emergency services immediately.",
							});
						}

						if (
							latestAssessments.checklist &&
							latestAssessments.checklist.checklist_analysis &&
							(latestAssessments.checklist.checklist_analysis.riskLevel === "high" ||
								latestAssessments.checklist.checklist_analysis.riskLevel === "critical")
						) {
							progressInsights.push({
								type: "warning",
								assessmentType: "checklist",
								message: `Latest personal problems checklist shows ${latestAssessments.checklist.checklist_analysis.riskLevel} risk level.`,
								severity: "high",
								recommendation:
									"Please contact your guidance counselor for support and intervention.",
							});
						}

						// Determine overall risk level
						let riskLevel = "low";
						if (
							latestAssessments.suicide?.riskLevel === "high" ||
							latestAssessments.anxiety?.severityLevel === "severe" ||
							latestAssessments.depression?.severityLevel === "severe" ||
							latestAssessments.stress?.severityLevel === "high" ||
							(latestAssessments.checklist?.checklist_analysis &&
								(latestAssessments.checklist.checklist_analysis.riskLevel === "high" ||
									latestAssessments.checklist.checklist_analysis.riskLevel === "critical"))
						) {
							riskLevel = "high";
						} else if (
							latestAssessments.suicide?.riskLevel === "moderate" ||
							latestAssessments.anxiety?.severityLevel === "moderate" ||
							latestAssessments.depression?.severityLevel === "moderate" ||
							latestAssessments.stress?.severityLevel === "moderate" ||
							(latestAssessments.checklist?.checklist_analysis &&
								latestAssessments.checklist.checklist_analysis.riskLevel === "moderate")
						) {
							riskLevel = "medium";
						}

						// Get last assessment date
						const allDates = [
							latestAssessments.anxiety?.assessmentDate,
							latestAssessments.stress?.assessmentDate,
							latestAssessments.depression?.assessmentDate,
							latestAssessments.suicide?.assessmentDate,
							latestAssessments.checklist?.date_completed,
						].filter(Boolean);

						const lastAssessmentDate =
							allDates.length > 0
								? new Date(
										Math.max(
											...allDates.map((date) => new Date(date as Date).getTime()),
										),
									)
								: null;

						return {
							studentId: student.id,
							studentName:
								`${student.person?.firstName || ""} ${student.person?.lastName || ""}`.trim(),
							studentNumber: student.studentNumber,
							program: student.program,
							year: student.year,
							totalAssessments,
							latestAssessments,
							progressInsights,
							riskLevel,
							lastAssessmentDate: lastAssessmentDate?.toISOString() || null,
						};
					})
					.filter(Boolean);

				const summary = {
					totalStudents: totalStudents, // Use the actual total count, not just the current page
					studentsWithAssessments: studentProgressInsights.filter(
						(s) => s && s.totalAssessments.overall > 0,
					).length,
					highRiskStudents: studentProgressInsights.filter(
						(s) => s && s.riskLevel === "high",
					).length,
					moderateRiskStudents: studentProgressInsights.filter(
						(s) => s && s.riskLevel === "medium",
					).length,
					lowRiskStudents: studentProgressInsights.filter(
						(s) => s && s.riskLevel === "low",
					).length,
				};

				const totalPages = Math.ceil(totalStudents / limit);

				console.log(
					`📊 Student progress overview generated: ${studentProgressInsights.length} of ${totalStudents} students (page ${page}/${totalPages})`,
				);

				// Debug: Log the final result structure
				const result = {
					students: studentProgressInsights,
					summary,
					pagination: {
						page,
						limit,
						total: totalStudents,
						totalPages,
						hasNextPage: page < totalPages,
						hasPrevPage: page > 1,
					},
				};
				console.log(`🔍 Final result structure:`, JSON.stringify(result, null, 2));

				return result;
			},
		},
		UserDashboard: {
			personalSummary: async () => {
				// Extract userId from filter (authenticated user context)
				const userId = filter.userFilter?.id;

				if (!userId) {
					throw new Error("User must be authenticated to access personal dashboard");
				}

				console.log(`🔍 API: Getting personal dashboard for authenticated user: ${userId}`);

				const user = await prisma.user.findUnique({
					where: { id: userId, isDeleted: false },
					include: {
						anxietyAssessments: {
							where: { isDeleted: false },
							orderBy: { assessmentDate: "desc" },
						},
						stressAssessments: {
							where: { isDeleted: false },
							orderBy: { assessmentDate: "desc" },
						},
						depressionAssessments: {
							where: { isDeleted: false },
							orderBy: { assessmentDate: "desc" },
						},
						suicideAssessments: {
							where: { isDeleted: false },
							orderBy: { assessmentDate: "desc" },
						},
						personalProblemsChecklist: {
							where: { isDeleted: false },
						},
						person: true,
					},
				});

				if (!user) {
					throw new Error("User not found");
				}

				const summary = {
					totalAssessments: {
						anxiety: user.anxietyAssessments.length,
						stress: user.stressAssessments.length,
						depression: user.depressionAssessments.length,
						suicide: user.suicideAssessments.length,
						checklist: user.personalProblemsChecklist ? 1 : 0,
						overall:
							user.anxietyAssessments.length +
							user.stressAssessments.length +
							user.depressionAssessments.length +
							user.suicideAssessments.length +
							(user.personalProblemsChecklist ? 1 : 0),
					},
					latestAssessments: {
						anxiety: user.anxietyAssessments[0] || null,
						stress: user.stressAssessments[0] || null,
						depression: user.depressionAssessments[0] || null,
						suicide: user.suicideAssessments[0] || null,
						checklist: user.personalProblemsChecklist ? {
							...user.personalProblemsChecklist,
							severityLevel: user.personalProblemsChecklist.checklist_analysis?.riskLevel || "unknown",
							totalScore: user.personalProblemsChecklist.checklist_analysis?.categoryScores ? 
								Object.values(user.personalProblemsChecklist.checklist_analysis.categoryScores as Record<string, number>)
									.reduce((sum, count) => sum + count, 0) : null,
						} : null,
					},
					userProfile: {
						id: user.id,
						userName: user.userName,
						type: user.type,
						status: user.status,
						lastLogin: user.lastLogin,
						createdAt: user.createdAt,
						person: user.person,
					},
				};

				console.log(`📊 Personal dashboard summary generated for user: ${userId}`);
				return summary;
			},

			assessmentHistory: async (assessmentType?: string, limit: number = 10) => {
				// Extract userId from filter (authenticated user context)
				const userId = filter.userFilter?.id;

				if (!userId) {
					throw new Error("User must be authenticated to access assessment history");
				}

				console.log(
					`🔍 API: Getting assessment history for authenticated user: ${userId}, type: ${assessmentType}`,
				);

				const user = await prisma.user.findUnique({
					where: { id: userId, isDeleted: false },
				});

				if (!user) {
					throw new Error("User not found");
				}

				let history: any[] = [];

				if (!assessmentType || assessmentType === "anxiety") {
					const anxietyAssessments = await prisma.anxietyAssessment.findMany({
						where: { userId, isDeleted: false },
						orderBy: { assessmentDate: "desc" },
						take: limit,
						select: {
							id: true,
							totalScore: true,
							severityLevel: true,
							assessmentDate: true,
							createdAt: true,
						},
					});
					history.push(...anxietyAssessments.map((a) => ({ ...a, type: "anxiety" })));
				}

				if (!assessmentType || assessmentType === "stress") {
					const stressAssessments = await prisma.stressAssessment.findMany({
						where: { userId, isDeleted: false },
						orderBy: { assessmentDate: "desc" },
						take: limit,
						select: {
							id: true,
							totalScore: true,
							severityLevel: true,
							assessmentDate: true,
							createdAt: true,
						},
					});
					history.push(...stressAssessments.map((a) => ({ ...a, type: "stress" })));
				}

				if (!assessmentType || assessmentType === "depression") {
					const depressionAssessments = await prisma.depressionAssessment.findMany({
						where: { userId, isDeleted: false },
						orderBy: { assessmentDate: "desc" },
						take: limit,
						select: {
							id: true,
							totalScore: true,
							severityLevel: true,
							assessmentDate: true,
							createdAt: true,
						},
					});
					history.push(
						...depressionAssessments.map((a) => ({ ...a, type: "depression" })),
					);
				}

				if (!assessmentType || assessmentType === "suicide") {
					const suicideAssessments = await prisma.suicideAssessment.findMany({
						where: { userId, isDeleted: false },
						orderBy: { assessmentDate: "desc" },
						take: limit,
						select: {
							id: true,
							riskLevel: true,
							requires_immediate_intervention: true,
							assessmentDate: true,
							createdAt: true,
						},
					});
					history.push(
						...suicideAssessments.map((a) => ({
							...a,
							type: "suicide",
							severityLevel: a.riskLevel, // Normalize field name
							totalScore: null, // Suicide assessments don't have numeric scores
						})),
					);
				}

				if (!assessmentType || assessmentType === "checklist") {
					const checklistAssessments = await prisma.personalProblemsChecklist.findMany({
						where: { userId, isDeleted: false },
						orderBy: { date_completed: "desc" },
						take: limit,
						select: {
							id: true,
							date_completed: true,
							createdAt: true,
							checklist_analysis: true,
						},
					});
					history.push(
						...checklistAssessments.map((a) => ({
							...a,
							type: "checklist",
							assessmentDate: a.date_completed, // Normalize field name
							severityLevel: a.checklist_analysis?.riskLevel || "unknown",
							totalScore: a.checklist_analysis?.categoryScores ? 
								Object.values(a.checklist_analysis.categoryScores as Record<string, number>)
									.reduce((sum, count) => sum + count, 0) : null,
						})),
					);
				}

				// Sort by assessment date descending and limit results
				history.sort(
					(a, b) =>
						new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime(),
				);
				if (assessmentType) {
					history = history.slice(0, limit);
				}

				console.log(`📊 Assessment history retrieved: ${history.length} records`);
				return history;
			},

			assessmentTrends: async (timeRange: string = "30d") => {
				// Extract userId from filter (authenticated user context)
				const userId = filter.userFilter?.id;

				if (!userId) {
					throw new Error("User must be authenticated to access assessment trends");
				}

				console.log(
					`🔍 API: Getting assessment trends for authenticated user: ${userId}, timeRange: ${timeRange}`,
				);

				// Helper function to convert UTC date to Philippine Time (UTC+8)
				const convertToPHT = (utcDate: Date): string => {
					const PHT_OFFSET = 8 * 60 * 60 * 1000; // +8 hours in milliseconds
					const phtDate = new Date(utcDate.getTime() + PHT_OFFSET);
					return phtDate.toISOString().split('T')[0];
				};

				// Calculate date range based on time filter
				const endDate = new Date();
				const startDate = new Date();
				
				switch (timeRange) {
					case "7d":
						startDate.setDate(endDate.getDate() - 7);
						break;
					case "30d":
						startDate.setDate(endDate.getDate() - 30);
						break;
					case "90d":
						startDate.setDate(endDate.getDate() - 90);
						break;
					case "1y":
						startDate.setFullYear(endDate.getFullYear() - 1);
						break;
					default:
						startDate.setDate(endDate.getDate() - 30);
				}

				const user = await prisma.user.findUnique({
					where: { id: userId, isDeleted: false },
				});

				if (!user) {
					throw new Error("User not found");
				}

				const [anxietyTrend, stressTrend, depressionTrend, suicideTrend, checklistTrend] =
					await Promise.all([
						prisma.anxietyAssessment.findMany({
							where: {
								userId,
								isDeleted: false,
								assessmentDate: { gte: startDate, lte: endDate },
							},
							orderBy: { assessmentDate: "asc" },
							select: {
								totalScore: true,
								severityLevel: true,
								assessmentDate: true,
							},
						}),
						prisma.stressAssessment.findMany({
							where: {
								userId,
								isDeleted: false,
								assessmentDate: { gte: startDate, lte: endDate },
							},
							orderBy: { assessmentDate: "asc" },
							select: {
								totalScore: true,
								severityLevel: true,
								assessmentDate: true,
							},
						}),
						prisma.depressionAssessment.findMany({
							where: {
								userId,
								isDeleted: false,
								assessmentDate: { gte: startDate, lte: endDate },
							},
							orderBy: { assessmentDate: "asc" },
							select: {
								totalScore: true,
								severityLevel: true,
								assessmentDate: true,
							},
						}),
						prisma.suicideAssessment.findMany({
							where: {
								userId,
								isDeleted: false,
								assessmentDate: { gte: startDate, lte: endDate },
							},
							orderBy: { assessmentDate: "asc" },
							select: {
								riskLevel: true,
								requires_immediate_intervention: true,
								assessmentDate: true,
							},
						}),
						prisma.personalProblemsChecklist.findMany({
							where: {
								userId,
								isDeleted: false,
								date_completed: { gte: startDate, lte: endDate },
							},
							orderBy: { date_completed: "asc" },
							select: {
								date_completed: true,
								checklist_analysis: true,
							},
						}),
					]);

				// Helper function to group assessments by date and aggregate severity levels
				const groupByDateAndAggregate = (assessments: any[], dateKey: string, scoreKey: string, levelKey: string) => {
					// Instead of grouping by date, return each assessment as a separate data point
					// This shows all assessments on the timeline without averaging
					// Convert to Philippine Time (UTC+8)
					return assessments.map(assessment => ({
						date: convertToPHT(new Date(assessment[dateKey])),
						score: assessment[scoreKey] || null,
						level: assessment[levelKey] || 'unknown',
						count: 1, // Each individual assessment
					})).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
				};

				// Group suicide assessments individually without averaging
				const groupSuicideByDate = (assessments: any[]) => {
					// Convert to Philippine Time (UTC+8)
					return assessments.map(assessment => ({
						date: convertToPHT(new Date(assessment.assessmentDate)),
						score: null,
						level: assessment.riskLevel || 'low',
						requiresIntervention: assessment.requires_immediate_intervention || false,
						count: 1, // Each individual assessment
					})).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
				};

				// Group checklist assessments individually without averaging
				const groupChecklistByDate = (assessments: any[]) => {
					return assessments.map(assessment => {
						const problemCount = assessment.checklist_analysis?.categoryScores ? 
							Object.values(assessment.checklist_analysis.categoryScores as Record<string, number>)
								.reduce((sum, count) => sum + count, 0) : null;
						
						return {
							date: convertToPHT(new Date(assessment.date_completed)),
							score: problemCount,
							level: assessment.checklist_analysis?.riskLevel || 'unknown',
							count: 1, // Each individual assessment
						};
					}).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
				};

				const trends = {
					period: timeRange,
					startDate: convertToPHT(startDate),
					endDate: convertToPHT(endDate),
					anxiety: groupByDateAndAggregate(anxietyTrend, 'assessmentDate', 'totalScore', 'severityLevel'),
					stress: groupByDateAndAggregate(stressTrend, 'assessmentDate', 'totalScore', 'severityLevel'),
					depression: groupByDateAndAggregate(depressionTrend, 'assessmentDate', 'totalScore', 'severityLevel'),
					suicide: groupSuicideByDate(suicideTrend),
					checklist: groupChecklistByDate(checklistTrend),
				};

				console.log(`📊 Assessment trends generated for ${timeRange}`);
				return trends;
			},

			assessmentStats: async () => {
				// Extract userId from filter (authenticated user context)
				const userId = filter.userFilter?.id;

				if (!userId) {
					throw new Error("User must be authenticated to access assessment statistics");
				}

				console.log(
					`🔍 API: Getting assessment statistics for authenticated user: ${userId}`,
				);

				const user = await prisma.user.findUnique({
					where: { id: userId, isDeleted: false },
				});

				if (!user) {
					throw new Error("User not found");
				}

				const [anxietyStats, stressStats, depressionStats, suicideStats, checklistStats] =
					await Promise.all([
						prisma.anxietyAssessment.aggregate({
							where: { userId, isDeleted: false },
							_count: { id: true },
							_avg: { totalScore: true },
							_min: { totalScore: true },
							_max: { totalScore: true },
						}),
						prisma.stressAssessment.aggregate({
							where: { userId, isDeleted: false },
							_count: { id: true },
							_avg: { totalScore: true },
							_min: { totalScore: true },
							_max: { totalScore: true },
						}),
						prisma.depressionAssessment.aggregate({
							where: { userId, isDeleted: false },
							_count: { id: true },
							_avg: { totalScore: true },
							_min: { totalScore: true },
							_max: { totalScore: true },
						}),
						prisma.suicideAssessment.aggregate({
							where: { userId, isDeleted: false },
							_count: { id: true },
						}),
						prisma.personalProblemsChecklist.aggregate({
							where: { userId, isDeleted: false },
							_count: { id: true },
						}),
					]);

				// Get first and latest assessment dates from all assessment types
				const allAssessmentDates: Date[] = [];

				// Collect all assessment dates
				const [anxietyDates, stressDates, depressionDates, suicideDates, checklistDates] =
					await Promise.all([
						prisma.anxietyAssessment.findMany({
							where: { userId, isDeleted: false },
							select: { assessmentDate: true },
						}),
						prisma.stressAssessment.findMany({
							where: { userId, isDeleted: false },
							select: { assessmentDate: true },
						}),
						prisma.depressionAssessment.findMany({
							where: { userId, isDeleted: false },
							select: { assessmentDate: true },
						}),
						prisma.suicideAssessment.findMany({
							where: { userId, isDeleted: false },
							select: { assessmentDate: true },
						}),
						prisma.personalProblemsChecklist.findMany({
							where: { userId, isDeleted: false },
							select: { date_completed: true },
						}),
					]);

				// Combine all dates
				allAssessmentDates.push(
					...anxietyDates.map((a) => a.assessmentDate),
					...stressDates.map((s) => s.assessmentDate),
					...depressionDates.map((d) => d.assessmentDate),
					...suicideDates.map((s) => s.assessmentDate),
					...checklistDates.map((c) => c.date_completed),
				);

				const firstAssessmentDate =
					allAssessmentDates.length > 0
						? new Date(Math.min(...allAssessmentDates.map((d) => d.getTime())))
						: null;
				const latestAssessmentDate =
					allAssessmentDates.length > 0
						? new Date(Math.max(...allAssessmentDates.map((d) => d.getTime())))
						: null;

				const stats = {
					anxiety: {
						count: anxietyStats._count.id,
						averageScore: anxietyStats._avg.totalScore
							? Math.round(anxietyStats._avg.totalScore * 100) / 100
							: null,
						minScore: anxietyStats._min.totalScore,
						maxScore: anxietyStats._max.totalScore,
					},
					stress: {
						count: stressStats._count.id,
						averageScore: stressStats._avg.totalScore
							? Math.round(stressStats._avg.totalScore * 100) / 100
							: null,
						minScore: stressStats._min.totalScore,
						maxScore: stressStats._max.totalScore,
					},
					depression: {
						count: depressionStats._count.id,
						averageScore: depressionStats._avg.totalScore
							? Math.round(depressionStats._avg.totalScore * 100) / 100
							: null,
						minScore: depressionStats._min.totalScore,
						maxScore: depressionStats._max.totalScore,
					},
					suicide: {
						count: suicideStats._count.id,
						averageScore: null, // Suicide assessments don't have numeric scores
						minScore: null,
						maxScore: null,
					},
					checklist: {
						count: checklistStats._count.id,
						averageScore: null, // Checklist uses problem counts, not scores
						minScore: null,
						maxScore: null,
					},
					overall: {
						totalAssessments:
							anxietyStats._count.id +
							stressStats._count.id +
							depressionStats._count.id +
							suicideStats._count.id +
							checklistStats._count.id,
						firstAssessmentDate,
						latestAssessmentDate,
					},
				};

				console.log(`📊 Assessment statistics generated for user: ${userId}`);
				return stats;
			},
		},
		RetakeRequest: {
			totalPendingRequests: async () => {
				const count = await prisma.retakeRequest.count({
					where: {
						isDeleted: false,
						status: "pending",
						...(filter.userFilter || {}),
					},
				});

				console.log(`📊 Pending retake requests count result: ${count}`);
				return count;
			},

			totalApprovedThisWeek: async () => {
				// Calculate start of current week (Sunday)
				const now = new Date();
				const startOfWeek = new Date(now);
				startOfWeek.setDate(now.getDate() - now.getDay());
				startOfWeek.setHours(0, 0, 0, 0);

				const count = await prisma.retakeRequest.count({
					where: {
						isDeleted: false,
						status: "approved",
						reviewedAt: {
							gte: startOfWeek,
						},
						...(filter.userFilter || {}),
					},
				});

				console.log(`📊 Approved this week retake requests count result: ${count}`);
				return count;
			},

			totalRequests: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					const startDate = new Date(filter.startDate);
					const endDate = filter.endDate ? new Date(filter.endDate) : null;

					dateFilter = {
						createdAt: {
							gte: startDate,
							...(endDate && { lte: endDate }),
						},
					};

					console.log(`🔍 API: RetakeRequest date filter applied`);
					console.log(`📅 Start Date: ${startDate.toISOString()}`);
					if (endDate) console.log(`📅 End Date: ${endDate.toISOString()}`);
				}

				const count = await prisma.retakeRequest.count({
					where: {
						isDeleted: false,
						...dateFilter,
						...(filter.userFilter || {}),
					},
				});

				console.log(`📊 Total retake requests count result: ${count}`);
				return count;
			},

			availableYears: async () => {
				const requests = await prisma.retakeRequest.findMany({
					where: {
						isDeleted: false,
					},
					select: {
						createdAt: true,
					},
				});

				const years = new Set<number>();
				requests.forEach((request) => {
					if (request.createdAt) {
						years.add(request.createdAt.getFullYear());
					}
				});

				return Array.from(years).sort((a, b) => b - a);
			},

			totalRequestsByStatus: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						createdAt: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				const requestsByStatus = await prisma.retakeRequest.groupBy({
					by: ["status"],
					where: {
						isDeleted: false,
						...dateFilter,
						...(filter.userFilter || {}),
					},
					_count: {
						status: true,
					},
				});

				return requestsByStatus.map((group) => ({
					status: group.status,
					count: group._count.status,
				}));
			},

			totalRequestsByAssessmentType: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						createdAt: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				const requestsByType = await prisma.retakeRequest.groupBy({
					by: ["assessmentType"],
					where: {
						isDeleted: false,
						...dateFilter,
						...(filter.userFilter || {}),
					},
					_count: {
						assessmentType: true,
					},
				});

				return requestsByType.map((group) => ({
					assessmentType: group.assessmentType,
					count: group._count.assessmentType,
				}));
			},
		},
		Dashboard: {
			getRecentTrends: async (days: number = 30) => {
				const startDate = new Date();
				startDate.setDate(startDate.getDate() - days);

				const dateFilter = {
					assessmentDate: {
						gte: startDate,
					},
				};

				// Get assessments grouped by day
				const [anxietyByDay, depressionByDay, stressByDay, checklistByDay, suicideByDay] = await Promise.all([
					prisma.anxietyAssessment.groupBy({
						by: ["assessmentDate"],
						where: {
							isDeleted: false,
							...dateFilter,
							...(filter.userFilter && { user: filter.userFilter }),
						},
						_count: {
							id: true,
						},
						orderBy: {
							assessmentDate: "asc",
						},
					}),
					prisma.depressionAssessment.groupBy({
						by: ["assessmentDate"],
						where: {
							isDeleted: false,
							...dateFilter,
							...(filter.userFilter && { user: filter.userFilter }),
						},
						_count: {
							id: true,
						},
						orderBy: {
							assessmentDate: "asc",
						},
					}),
					prisma.stressAssessment.groupBy({
						by: ["assessmentDate"],
						where: {
							isDeleted: false,
							...dateFilter,
							...(filter.userFilter && { user: filter.userFilter }),
						},
						_count: {
							id: true,
						},
						orderBy: {
							assessmentDate: "asc",
						},
					}),
					prisma.personalProblemsChecklist.groupBy({
						by: ["date_completed"],
						where: {
							isDeleted: false,
							date_completed: {
								gte: startDate,
							},
							...(filter.userFilter && { user: filter.userFilter }),
						},
						_count: {
							id: true,
						},
						orderBy: {
							date_completed: "asc",
						},
					}),
					prisma.suicideAssessment.groupBy({
						by: ["assessmentDate"],
						where: {
							isDeleted: false,
							...dateFilter,
							...(filter.userFilter && { user: filter.userFilter }),
						},
						_count: {
							id: true,
						},
						orderBy: {
							assessmentDate: "asc",
						},
					}),
				]);

				// Generate date array based on the requested number of days
				const dateRange = [];
				for (let i = days - 1; i >= 0; i--) {
					const date = new Date();
					date.setDate(date.getDate() - i);
					const dateStr = date.toISOString().split("T")[0];
					dateRange.push(dateStr);
				}

				// Map data to consistent format
				const trendsData = dateRange.map((dateStr) => {
					const anxiety =
						anxietyByDay.find(
							(item) => item.assessmentDate.toISOString().split("T")[0] === dateStr,
						)?._count.id || 0;

					const depression =
						depressionByDay.find(
							(item) => item.assessmentDate.toISOString().split("T")[0] === dateStr,
						)?._count.id || 0;

					const stress =
						stressByDay.find(
							(item) => item.assessmentDate.toISOString().split("T")[0] === dateStr,
						)?._count.id || 0;

					const checklist =
						checklistByDay.find(
							(item) => item.date_completed.toISOString().split("T")[0] === dateStr,
						)?._count.id || 0;

					const suicide =
						suicideByDay.find(
							(item) => item.assessmentDate.toISOString().split("T")[0] === dateStr,
						)?._count.id || 0;

					// Format date based on the number of days
					let dateFormat;
					if (days <= 7) {
						// For 7 days or less, show "MMM DD" format
						dateFormat = new Date(dateStr).toLocaleDateString("en-US", {
							month: "short",
							day: "numeric",
						});
					} else if (days <= 30) {
						// For 30 days or less, show "MMM DD" format
						dateFormat = new Date(dateStr).toLocaleDateString("en-US", {
							month: "short",
							day: "numeric",
						});
					} else {
						// For longer periods, show "MMM DD" format but with weekly intervals
						dateFormat = new Date(dateStr).toLocaleDateString("en-US", {
							month: "short",
							day: "numeric",
						});
					}

					return {
						date: dateFormat,
						anxiety,
						depression,
						stress,
						checklist,
						suicide,
					};
				});

				return trendsData;
			},

			getSeverityDistribution: async () => {
				const [anxietySeverity, depressionSeverity, stressSeverity] = await Promise.all([
					prisma.anxietyAssessment.groupBy({
						by: ["severityLevel"],
						where: {
							isDeleted: false,
							...(filter.userFilter && { user: filter.userFilter }),
						},
						_count: {
							severityLevel: true,
						},
					}),
					prisma.depressionAssessment.groupBy({
						by: ["severityLevel"],
						where: {
							isDeleted: false,
							...(filter.userFilter && { user: filter.userFilter }),
						},
						_count: {
							severityLevel: true,
						},
					}),
					prisma.stressAssessment.groupBy({
						by: ["severityLevel"],
						where: {
							isDeleted: false,
							...(filter.userFilter && { user: filter.userFilter }),
						},
						_count: {
							severityLevel: true,
						},
					}),
				]);

				// Map severity levels to standardized format
				const severityMap: Record<
					string,
					{ anxiety: number; depression: number; stress: number }
				> = {
					Minimal: { anxiety: 0, depression: 0, stress: 0 },
					Mild: { anxiety: 0, depression: 0, stress: 0 },
					Moderate: { anxiety: 0, depression: 0, stress: 0 },
					Severe: { anxiety: 0, depression: 0, stress: 0 },
				};

				// Map anxiety severity data
				anxietySeverity.forEach((item) => {
					const level = item.severityLevel || "Unknown";
					if (level in severityMap) {
						severityMap[level].anxiety = item._count.severityLevel;
					}
				});

				// Map depression severity data
				depressionSeverity.forEach((item) => {
					const level = item.severityLevel || "Unknown";
					if (level in severityMap) {
						severityMap[level].depression = item._count.severityLevel;
					}
				});

				// Map stress severity data
				stressSeverity.forEach((item) => {
					const level = item.severityLevel || "Unknown";
					if (level in severityMap) {
						severityMap[level].stress = item._count.severityLevel;
					}
				});

				// Convert to array format
				return Object.entries(severityMap).map(([severity, counts]) => ({
					severity,
					...counts,
				}));
			},

			getMonthlyStats: async (months: number = 6) => {
				const startDate = new Date();
				startDate.setMonth(startDate.getMonth() - months);

				const [anxietyMonthly, depressionMonthly, stressMonthly] = await Promise.all([
					prisma.anxietyAssessment.findMany({
						where: {
							isDeleted: false,
							assessmentDate: { gte: startDate },
							...(filter.userFilter && { user: filter.userFilter }),
						},
						select: {
							assessmentDate: true,
						},
					}),
					prisma.depressionAssessment.findMany({
						where: {
							isDeleted: false,
							assessmentDate: { gte: startDate },
							...(filter.userFilter && { user: filter.userFilter }),
						},
						select: {
							assessmentDate: true,
						},
					}),
					prisma.stressAssessment.findMany({
						where: {
							isDeleted: false,
							assessmentDate: { gte: startDate },
							...(filter.userFilter && { user: filter.userFilter }),
						},
						select: {
							assessmentDate: true,
						},
					}),
				]);

				// Generate last 6 months array
				const monthsArray = [];
				for (let i = months - 1; i >= 0; i--) {
					const date = new Date();
					date.setMonth(date.getMonth() - i);
					monthsArray.push({
						year: date.getFullYear(),
						month: date.getMonth() + 1,
						label: date.toLocaleDateString("en-US", {
							month: "short",
							year: "numeric",
						}),
					});
				}

				// Map data to consistent format
				return monthsArray.map((monthInfo) => {
					const anxiety = anxietyMonthly.filter(
						(item) =>
							item.assessmentDate.getFullYear() === monthInfo.year &&
							item.assessmentDate.getMonth() + 1 === monthInfo.month,
					).length;

					const depression = depressionMonthly.filter(
						(item) =>
							item.assessmentDate.getFullYear() === monthInfo.year &&
							item.assessmentDate.getMonth() + 1 === monthInfo.month,
					).length;

					const stress = stressMonthly.filter(
						(item) =>
							item.assessmentDate.getFullYear() === monthInfo.year &&
							item.assessmentDate.getMonth() + 1 === monthInfo.month,
					).length;

					return {
						month: monthInfo.label,
						anxiety,
						depression,
						stress,
					};
				});
			},
		},
	};
};
