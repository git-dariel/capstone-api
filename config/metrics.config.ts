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
						overall:
							user.anxietyAssessments.length +
							user.stressAssessments.length +
							user.depressionAssessments.length +
							user.suicideAssessments.length,
					},
					latestAssessments: {
						anxiety: user.anxietyAssessments[0] || null,
						stress: user.stressAssessments[0] || null,
						depression: user.depressionAssessments[0] || null,
						suicide: user.suicideAssessments[0] || null,
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

			assessmentTrends: async (days: number = 30) => {
				// Extract userId from filter (authenticated user context)
				const userId = filter.userFilter?.id;

				if (!userId) {
					throw new Error("User must be authenticated to access assessment trends");
				}

				console.log(
					`🔍 API: Getting assessment trends for authenticated user: ${userId}, last ${days} days`,
				);

				const startDate = new Date();
				startDate.setDate(startDate.getDate() - days);

				const user = await prisma.user.findUnique({
					where: { id: userId, isDeleted: false },
				});

				if (!user) {
					throw new Error("User not found");
				}

				const [anxietyTrend, stressTrend, depressionTrend, suicideTrend] =
					await Promise.all([
						prisma.anxietyAssessment.findMany({
							where: {
								userId,
								isDeleted: false,
								assessmentDate: { gte: startDate },
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
								assessmentDate: { gte: startDate },
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
								assessmentDate: { gte: startDate },
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
								assessmentDate: { gte: startDate },
							},
							orderBy: { assessmentDate: "asc" },
							select: {
								riskLevel: true,
								requires_immediate_intervention: true,
								assessmentDate: true,
							},
						}),
					]);

				const trends = {
					period: `Last ${days} days`,
					startDate,
					endDate: new Date(),
					anxiety: anxietyTrend.map((a) => ({
						score: a.totalScore,
						level: a.severityLevel,
						date: a.assessmentDate,
					})),
					stress: stressTrend.map((s) => ({
						score: s.totalScore,
						level: s.severityLevel,
						date: s.assessmentDate,
					})),
					depression: depressionTrend.map((d) => ({
						score: d.totalScore,
						level: d.severityLevel,
						date: d.assessmentDate,
					})),
					suicide: suicideTrend.map((s) => ({
						score: null, // Suicide assessments don't have numeric scores
						level: s.riskLevel,
						requiresIntervention: s.requires_immediate_intervention,
						date: s.assessmentDate,
					})),
				};

				console.log(`📊 Assessment trends generated for last ${days} days`);
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

				const [anxietyStats, stressStats, depressionStats, suicideStats] =
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
					]);

				// Get first and latest assessment dates from all assessment types
				const allAssessmentDates: Date[] = [];

				// Collect all assessment dates
				const [anxietyDates, stressDates, depressionDates, suicideDates] =
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
					]);

				// Combine all dates
				allAssessmentDates.push(
					...anxietyDates.map((a) => a.assessmentDate),
					...stressDates.map((s) => s.assessmentDate),
					...depressionDates.map((d) => d.assessmentDate),
					...suicideDates.map((s) => s.assessmentDate),
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
					overall: {
						totalAssessments:
							anxietyStats._count.id +
							stressStats._count.id +
							depressionStats._count.id +
							suicideStats._count.id,
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
	};
};
