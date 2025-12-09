import { PrismaClient } from "../generated/prisma";

interface MetricFilter {
	userFilter?: Record<string, any>;
	startDate?: string | Date;
	endDate?: string | Date;
	page?: number;
	limit?: number;
	program?: string;
	yearLevel?: string;
	gender?: string;
	assessmentId?: string;
	assessmentType?: string;
	riskLevel?: string;
	severityLevel?: string;
	bmiCategory?: string;
}

// Utility function to get standard student filter (excludes graduated students)
const getActiveStudentFilter = () => ({
	isDeleted: false,
	year: {
		not: "graduated",
	},
});

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
						...getActiveStudentFilter(),
						person: {
							users: {
								some: filter.userFilter || {},
							},
						},
					},
				}),

			totalStudentByProgram: async () => {
				const studentsWithProgram = await prisma.student.findMany({
					where: {
						...getActiveStudentFilter(),
						person: {
							users: {
								some: filter.userFilter || {},
							},
						},
					},
					select: {
						id: true,
						program: true,
					},
				});

				// Count unique students per program
				const programCounts: Record<string, number> = {};
				studentsWithProgram.forEach((student) => {
					if (student.program) {
						programCounts[student.program] = (programCounts[student.program] || 0) + 1;
					}
				});

				return Object.entries(programCounts).map(([program, count]) => ({
					program,
					count,
				}));
			},

			totalStudentByYear: async () => {
				const studentsWithYear = await prisma.student.findMany({
					where: {
						...getActiveStudentFilter(),
						person: {
							users: {
								some: filter.userFilter || {},
							},
						},
					},
					select: {
						id: true,
						year: true,
					},
				});

				// Count unique students per year level
				const yearCounts: Record<string, number> = {};
				studentsWithYear.forEach((student) => {
					if (student.year) {
						yearCounts[student.year] = (yearCounts[student.year] || 0) + 1;
					}
				});

				return Object.entries(yearCounts).map(([year, count]) => ({
					year,
					count,
				}));
			},
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

				// Get latest anxiety assessment per user instead of counting all assessments
				const latestAssessments = await prisma.anxietyAssessment.groupBy({
					by: ["userId"],
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
					_max: {
						assessmentDate: true,
					},
				});

				const count = latestAssessments.length;
				console.log(`📊 Anxiety latest assessments count: ${count}`);
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
											where: getActiveStudentFilter(),
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

				// Count unique students per program
				const programStudentSets: Record<string, Set<string>> = {};
				anxietyWithProgram.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						if (!programStudentSets[student.program]) {
							programStudentSets[student.program] = new Set();
						}
						programStudentSets[student.program].add(student.id);
					});
				});

				const result = Object.entries(programStudentSets).map(([program, studentSet]) => ({
					program,
					count: studentSet.size, // Count unique students
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
											where: getActiveStudentFilter(),
										},
									},
								},
							},
						},
					},
				});

				// Count unique students per year level
				const yearStudentSets: Record<string, Set<string>> = {};
				anxietyWithYear.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						// Filter by program if specified
						if (
							filter.program &&
							student.program.toLowerCase() !== filter.program.toLowerCase()
						) {
							return;
						}

						if (!yearStudentSets[student.year]) {
							yearStudentSets[student.year] = new Set();
						}
						yearStudentSets[student.year].add(student.id);
					});
				});

				return Object.entries(yearStudentSets).map(([year, studentSet]) => ({
					year,
					count: studentSet.size, // Count unique students
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
								person: {
									include: {
										students: {
											where: getActiveStudentFilter(),
										},
									},
								},
							},
						},
					},
				});

				// Count unique students per gender
				const genderStudentSets: Record<string, Set<string>> = {};
				anxietyWithGender.forEach((assessment) => {
					const gender = assessment.user.person?.gender || "unknown";
					const students = assessment.user.person?.students || [];

					students.forEach((student) => {
						// Filter by program if specified (case-insensitive)
						if (
							filter.program &&
							student.program.toLowerCase() !== filter.program.toLowerCase()
						) {
							return;
						}
						// Filter by year level if specified (case-insensitive)
						if (
							filter.yearLevel &&
							student.year.toLowerCase() !== filter.yearLevel.toLowerCase()
						) {
							return;
						}

						if (!genderStudentSets[gender]) {
							genderStudentSets[gender] = new Set();
						}
						genderStudentSets[gender].add(student.id);
					});
				});

				return Object.entries(genderStudentSets).map(([gender, studentSet]) => ({
					gender,
					count: studentSet.size, // Count unique students
				}));
			},

			assessmentStudentList: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						assessmentDate: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				const assessments = await prisma.anxietyAssessment.findMany({
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
											where: getActiveStudentFilter(),
										},
									},
								},
							},
						},
					},
					orderBy: {
						assessmentDate: "desc",
					},
				});

				// Collect unique students matching filters
				const studentMap = new Map();

				assessments.forEach((assessment) => {
					const students = assessment.user.person?.students || [];

					students.forEach((student) => {
						// Apply filters
						if (
							filter.program &&
							student.program.toLowerCase() !== filter.program.toLowerCase()
						) {
							return;
						}
						if (
							filter.yearLevel &&
							student.year.toLowerCase() !== filter.yearLevel.toLowerCase()
						) {
							return;
						}
						if (
							filter.gender &&
							assessment.user.person?.gender?.toLowerCase() !==
								filter.gender.toLowerCase()
						) {
							return;
						}

						// Only add each student once
						if (!studentMap.has(student.id)) {
							studentMap.set(student.id, {
								id: student.id,
								studentNumber: student.studentNumber,
								firstName: assessment.user.person?.firstName || "",
								lastName: assessment.user.person?.lastName || "",
								email: assessment.user.person?.email || "",
								program: student.program,
								year: student.year,
								gender: assessment.user.person?.gender || "unknown",
								assessmentType: "anxiety",
								severity: assessment.severityLevel,
								score: assessment.totalScore,
								assessmentDate: assessment.assessmentDate?.toISOString(),
								createdAt: assessment.createdAt.toISOString(),
							});
						}
					});
				});

				return Array.from(studentMap.values());
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

				// Get latest stress assessment per user instead of counting all assessments
				const latestAssessments = await prisma.stressAssessment.groupBy({
					by: ["userId"],
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
					_max: {
						assessmentDate: true,
					},
				});

				const count = latestAssessments.length;
				console.log(`📊 Stress latest assessments count: ${count}`);
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
											where: getActiveStudentFilter(),
										},
									},
								},
							},
						},
					},
				});

				// Count unique students per program
				const programStudentSets: Record<string, Set<string>> = {};
				stressWithProgram.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						if (!programStudentSets[student.program]) {
							programStudentSets[student.program] = new Set();
						}
						programStudentSets[student.program].add(student.id);
					});
				});

				return Object.entries(programStudentSets).map(([program, studentSet]) => ({
					program,
					count: studentSet.size, // Count unique students
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
											where: getActiveStudentFilter(),
										},
									},
								},
							},
						},
					},
				});

				// Count unique students per year level
				const yearStudentSets: Record<string, Set<string>> = {};
				stressWithYear.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						// Filter by program if specified
						if (
							filter.program &&
							student.program.toLowerCase() !== filter.program.toLowerCase()
						) {
							return;
						}

						if (!yearStudentSets[student.year]) {
							yearStudentSets[student.year] = new Set();
						}
						yearStudentSets[student.year].add(student.id);
					});
				});

				return Object.entries(yearStudentSets).map(([year, studentSet]) => ({
					year,
					count: studentSet.size, // Count unique students
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
								person: {
									include: {
										students: {
											where: getActiveStudentFilter(),
										},
									},
								},
							},
						},
					},
				});

				// Count unique students per gender
				const genderStudentSets: Record<string, Set<string>> = {};
				stressWithGender.forEach((assessment) => {
					const gender = assessment.user.person?.gender || "unknown";
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						// Filter by program if specified
						if (
							filter.program &&
							student.program.toLowerCase() !== filter.program.toLowerCase()
						) {
							return;
						}
						// Filter by year level if specified
						if (
							filter.yearLevel &&
							student.year.toLowerCase() !== filter.yearLevel.toLowerCase()
						) {
							return;
						}

						if (!genderStudentSets[gender]) {
							genderStudentSets[gender] = new Set();
						}
						genderStudentSets[gender].add(student.id);
					});
				});

				return Object.entries(genderStudentSets).map(([gender, studentSet]) => ({
					gender,
					count: studentSet.size, // Count unique students
				}));
			},

			assessmentStudentList: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						assessmentDate: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				const assessments = await prisma.stressAssessment.findMany({
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
											where: getActiveStudentFilter(),
										},
									},
								},
							},
						},
					},
					orderBy: {
						assessmentDate: "desc",
					},
				});

				// Collect unique students matching filters
				const studentMap = new Map();

				assessments.forEach((assessment) => {
					const students = assessment.user.person?.students || [];

					students.forEach((student) => {
						// Apply filters
						if (
							filter.program &&
							student.program.toLowerCase() !== filter.program.toLowerCase()
						) {
							return;
						}
						if (
							filter.yearLevel &&
							student.year.toLowerCase() !== filter.yearLevel.toLowerCase()
						) {
							return;
						}
						if (
							filter.gender &&
							assessment.user.person?.gender?.toLowerCase() !==
								filter.gender.toLowerCase()
						) {
							return;
						}

						// Only add each student once
						if (!studentMap.has(student.id)) {
							studentMap.set(student.id, {
								id: student.id,
								studentNumber: student.studentNumber,
								firstName: assessment.user.person?.firstName || "",
								lastName: assessment.user.person?.lastName || "",
								email: assessment.user.person?.email || "",
								program: student.program,
								year: student.year,
								gender: assessment.user.person?.gender || "unknown",
								assessmentType: "stress",
								severity: assessment.severityLevel,
								score: assessment.totalScore,
								assessmentDate: assessment.assessmentDate?.toISOString(),
								createdAt: assessment.createdAt.toISOString(),
							});
						}
					});
				});

				return Array.from(studentMap.values());
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

				// Get latest depression assessment per user instead of counting all assessments
				const latestAssessments = await prisma.depressionAssessment.groupBy({
					by: ["userId"],
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
					_max: {
						assessmentDate: true,
					},
				});

				const count = latestAssessments.length;
				console.log(`📊 Depression latest assessments count: ${count}`);
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
											where: getActiveStudentFilter(),
										},
									},
								},
							},
						},
					},
				});

				// Count unique students per program
				const programStudentSets: Record<string, Set<string>> = {};
				depressionWithProgram.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						if (!programStudentSets[student.program]) {
							programStudentSets[student.program] = new Set();
						}
						programStudentSets[student.program].add(student.id);
					});
				});

				return Object.entries(programStudentSets).map(([program, studentSet]) => ({
					program,
					count: studentSet.size, // Count unique students
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
											where: getActiveStudentFilter(),
										},
									},
								},
							},
						},
					},
				});

				// Count unique students per year level
				const yearStudentSets: Record<string, Set<string>> = {};
				depressionWithYear.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						// Filter by program if specified
						if (
							filter.program &&
							student.program.toLowerCase() !== filter.program.toLowerCase()
						) {
							return;
						}

						if (!yearStudentSets[student.year]) {
							yearStudentSets[student.year] = new Set();
						}
						yearStudentSets[student.year].add(student.id);
					});
				});

				return Object.entries(yearStudentSets).map(([year, studentSet]) => ({
					year,
					count: studentSet.size, // Count unique students
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
								person: {
									include: {
										students: {
											where: getActiveStudentFilter(),
										},
									},
								},
							},
						},
					},
				});

				// Count unique students per gender
				const genderStudentSets: Record<string, Set<string>> = {};
				depressionWithGender.forEach((assessment) => {
					const gender = assessment.user.person?.gender || "unknown";
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						// Filter by program if specified
						if (
							filter.program &&
							student.program.toLowerCase() !== filter.program.toLowerCase()
						) {
							return;
						}
						// Filter by year level if specified
						if (
							filter.yearLevel &&
							student.year.toLowerCase() !== filter.yearLevel.toLowerCase()
						) {
							return;
						}

						if (!genderStudentSets[gender]) {
							genderStudentSets[gender] = new Set();
						}
						genderStudentSets[gender].add(student.id);
					});
				});

				return Object.entries(genderStudentSets).map(([gender, studentSet]) => ({
					gender,
					count: studentSet.size, // Count unique students
				}));
			},

			assessmentStudentList: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						assessmentDate: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				const assessments = await prisma.depressionAssessment.findMany({
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
											where: getActiveStudentFilter(),
										},
									},
								},
							},
						},
					},
					orderBy: {
						assessmentDate: "desc",
					},
				});

				// Collect unique students matching filters
				const studentMap = new Map();

				assessments.forEach((assessment) => {
					const students = assessment.user.person?.students || [];

					students.forEach((student) => {
						// Apply filters
						if (
							filter.program &&
							student.program.toLowerCase() !== filter.program.toLowerCase()
						) {
							return;
						}
						if (
							filter.yearLevel &&
							student.year.toLowerCase() !== filter.yearLevel.toLowerCase()
						) {
							return;
						}
						if (
							filter.gender &&
							assessment.user.person?.gender?.toLowerCase() !==
								filter.gender.toLowerCase()
						) {
							return;
						}

						// Only add each student once
						if (!studentMap.has(student.id)) {
							studentMap.set(student.id, {
								id: student.id,
								studentNumber: student.studentNumber,
								firstName: assessment.user.person?.firstName || "",
								lastName: assessment.user.person?.lastName || "",
								email: assessment.user.person?.email || "",
								program: student.program,
								year: student.year,
								gender: assessment.user.person?.gender || "unknown",
								assessmentType: "depression",
								severity: assessment.severityLevel,
								score: assessment.totalScore,
								assessmentDate: assessment.assessmentDate?.toISOString(),
								createdAt: assessment.createdAt.toISOString(),
							});
						}
					});
				});

				return Array.from(studentMap.values());
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

				// Get latest suicide assessment per user instead of counting all assessments
				const latestAssessments = await prisma.suicideAssessment.groupBy({
					by: ["userId"],
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
					_max: {
						assessmentDate: true,
					},
				});

				const count = latestAssessments.length;
				console.log(`📊 Suicide latest assessments count: ${count}`);
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
											where: getActiveStudentFilter(),
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

				// Count unique students per program
				const programStudentSets: Record<string, Set<string>> = {};
				suicideWithProgram.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						const program = student.program || "Unknown";
						if (!programStudentSets[program]) {
							programStudentSets[program] = new Set();
						}
						programStudentSets[program].add(student.id);
					});
				});

				const result = Object.entries(programStudentSets).map(([program, studentSet]) => ({
					program,
					count: studentSet.size, // Count unique students
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
											where: getActiveStudentFilter(),
										},
									},
								},
							},
						},
					},
				});

				// Count unique students per year level
				const yearStudentSets: Record<string, Set<string>> = {};
				suicideWithYear.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						const year = student.year || "Unknown";

						// Filter by program if specified
						if (
							filter.program &&
							student.program.toLowerCase() !== filter.program.toLowerCase()
						) {
							return;
						}

						if (!yearStudentSets[year]) {
							yearStudentSets[year] = new Set();
						}
						yearStudentSets[year].add(student.id);
					});
				});

				return Object.entries(yearStudentSets).map(([year, studentSet]) => ({
					year,
					count: studentSet.size, // Count unique students
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
								person: {
									include: {
										students: {
											where: getActiveStudentFilter(),
										},
									},
								},
							},
						},
					},
				});

				// Count unique students per gender
				const genderStudentSets: Record<string, Set<string>> = {};
				suicideWithGender.forEach((assessment) => {
					const gender = assessment.user.person?.gender || "Unknown";
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						// Filter by program if specified
						if (
							filter.program &&
							student.program.toLowerCase() !== filter.program.toLowerCase()
						) {
							return;
						}
						// Filter by year level if specified
						if (
							filter.yearLevel &&
							student.year.toLowerCase() !== filter.yearLevel.toLowerCase()
						) {
							return;
						}

						if (!genderStudentSets[gender]) {
							genderStudentSets[gender] = new Set();
						}
						genderStudentSets[gender].add(student.id);
					});
				});

				return Object.entries(genderStudentSets).map(([gender, studentSet]) => ({
					gender,
					count: studentSet.size, // Count unique students
				}));
			},

			assessmentStudentList: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						assessmentDate: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				const assessments = await prisma.suicideAssessment.findMany({
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
											where: getActiveStudentFilter(),
										},
									},
								},
							},
						},
					},
					orderBy: {
						assessmentDate: "desc",
					},
				});

				// Collect unique students matching filters
				const studentMap = new Map();

				assessments.forEach((assessment) => {
					const students = assessment.user.person?.students || [];

					students.forEach((student) => {
						// Apply filters
						if (
							filter.program &&
							student.program.toLowerCase() !== filter.program.toLowerCase()
						) {
							return;
						}
						if (
							filter.yearLevel &&
							student.year.toLowerCase() !== filter.yearLevel.toLowerCase()
						) {
							return;
						}
						if (
							filter.gender &&
							assessment.user.person?.gender?.toLowerCase() !==
								filter.gender.toLowerCase()
						) {
							return;
						}

						// Only add each student once
						if (!studentMap.has(student.id)) {
							studentMap.set(student.id, {
								id: student.id,
								studentNumber: student.studentNumber,
								firstName: assessment.user.person?.firstName || "",
								lastName: assessment.user.person?.lastName || "",
								email: assessment.user.person?.email || "",
								program: student.program,
								year: student.year,
								gender: assessment.user.person?.gender || "unknown",
								assessmentType: "suicide",
								severity: assessment.riskLevel,
								score: undefined, // Suicide assessment doesn't have a score
								assessmentDate: assessment.assessmentDate?.toISOString(),
								createdAt: assessment.createdAt.toISOString(),
							});
						}
					});
				});

				return Array.from(studentMap.values());
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

				// Get latest checklist assessment per user instead of counting all assessments
				const latestAssessments = await prisma.personalProblemsChecklist.groupBy({
					by: ["userId"],
					where: {
						isDeleted: false,
						...dateFilter,
						user: filter.userFilter || {},
					},
					_max: {
						date_completed: true,
					},
				});

				const count = latestAssessments.length;
				console.log(`📊 Checklist latest assessments count: ${count}`);
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
											where: getActiveStudentFilter(),
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

				// Count unique students per program
				const programStudentSets: Record<string, Set<string>> = {};
				checklistWithProgram.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						const program = student.program || "Unknown";
						if (!programStudentSets[program]) {
							programStudentSets[program] = new Set();
						}
						programStudentSets[program].add(student.id);
					});
				});

				const result = Object.entries(programStudentSets).map(([program, studentSet]) => ({
					program,
					count: studentSet.size, // Count unique students
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
											where: getActiveStudentFilter(),
										},
									},
								},
							},
						},
					},
				});

				// Count unique students per year level
				const yearStudentSets: Record<string, Set<string>> = {};
				checklistWithYear.forEach((assessment) => {
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						const year = student.year || "Unknown";

						// Filter by program if specified
						if (
							filter.program &&
							student.program.toLowerCase() !== filter.program.toLowerCase()
						) {
							return;
						}

						if (!yearStudentSets[year]) {
							yearStudentSets[year] = new Set();
						}
						yearStudentSets[year].add(student.id);
					});
				});

				return Object.entries(yearStudentSets).map(([year, studentSet]) => ({
					year,
					count: studentSet.size, // Count unique students
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
								person: {
									include: {
										students: {
											where: getActiveStudentFilter(),
										},
									},
								},
							},
						},
					},
				});

				// Count unique students per gender
				const genderStudentSets: Record<string, Set<string>> = {};
				checklistWithGender.forEach((assessment) => {
					const gender = assessment.user.person?.gender || "Unknown";
					const students = assessment.user.person?.students || [];
					students.forEach((student) => {
						// Filter by program if specified
						if (
							filter.program &&
							student.program.toLowerCase() !== filter.program.toLowerCase()
						) {
							return;
						}
						// Filter by year level if specified
						if (
							filter.yearLevel &&
							student.year.toLowerCase() !== filter.yearLevel.toLowerCase()
						) {
							return;
						}

						if (!genderStudentSets[gender]) {
							genderStudentSets[gender] = new Set();
						}
						genderStudentSets[gender].add(student.id);
					});
				});

				return Object.entries(genderStudentSets).map(([gender, studentSet]) => ({
					gender,
					count: studentSet.size, // Count unique students
				}));
			},

			assessmentStudentList: async () => {
				let dateFilter = {};

				if (filter.startDate) {
					dateFilter = {
						date_completed: {
							gte: new Date(filter.startDate),
							...(filter.endDate && { lte: new Date(filter.endDate) }),
						},
					};
				}

				const assessments = await prisma.personalProblemsChecklist.findMany({
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
											where: getActiveStudentFilter(),
										},
									},
								},
							},
						},
					},
					orderBy: {
						date_completed: "desc",
					},
				});

				// Collect unique students matching filters
				const studentMap = new Map();

				assessments.forEach((assessment) => {
					const students = assessment.user.person?.students || [];

					students.forEach((student) => {
						// Apply filters
						if (
							filter.program &&
							student.program.toLowerCase() !== filter.program.toLowerCase()
						) {
							return;
						}
						if (
							filter.yearLevel &&
							student.year.toLowerCase() !== filter.yearLevel.toLowerCase()
						) {
							return;
						}
						if (
							filter.gender &&
							assessment.user.person?.gender?.toLowerCase() !==
								filter.gender.toLowerCase()
						) {
							return;
						}

						// Only add each student once
						if (!studentMap.has(student.id)) {
							studentMap.set(student.id, {
								id: student.id,
								studentNumber: student.studentNumber,
								firstName: assessment.user.person?.firstName || "",
								lastName: assessment.user.person?.lastName || "",
								email: assessment.user.person?.email || "",
								program: student.program,
								year: student.year,
								gender: assessment.user.person?.gender || "unknown",
								assessmentType: "checklist",
								severity: undefined, // Checklist doesn't have severity
								score: undefined, // Checklist doesn't have a score
								assessmentDate: assessment.date_completed?.toISOString(),
								createdAt: assessment.createdAt.toISOString(),
							});
						}
					});
				});

				return Array.from(studentMap.values());
			},
		},
		GuidanceDashboard: {
			studentProgressOverview: async () => {
				try {
					// Extract pagination parameters from filter
					const page = filter?.page ? Number(filter.page) : 1;
					const limit = filter?.limit ? Number(filter.limit) : 10;
					const skip = (page - 1) * limit;

					// Get total count of students with valid person relations
					const totalStudents = await prisma.student.count({
						where: {
							isDeleted: false,
							person: {
								isDeleted: false,
							},
						},
					});

					// Get paginated students with their assessment data
					// Filter to only include students that have a valid, non-deleted person relation
					// Use studentNumber for ordering to avoid issues with null person fields
					let students;
					try {
						students = await prisma.student.findMany({
							where: {
								isDeleted: false,
								person: {
									isDeleted: false, // Ensure person is not deleted
								},
							},
							skip,
							take: limit,
							orderBy: { studentNumber: "asc" }, // Use simple ordering to avoid null issues
							include: {
								person: {
									include: {
										users: {
											where: { type: "student", isDeleted: false },
											include: {
												anxietyAssessments: {
													where: getActiveStudentFilter(),
													orderBy: { assessmentDate: "desc" },
													take: 1,
												},
												stressAssessments: {
													where: getActiveStudentFilter(),
													orderBy: { assessmentDate: "desc" },
													take: 1,
												},
												depressionAssessments: {
													where: getActiveStudentFilter(),
													orderBy: { assessmentDate: "desc" },
													take: 1,
												},
												suicideAssessments: {
													where: getActiveStudentFilter(),
													orderBy: { assessmentDate: "desc" },
													take: 1,
												},
												personalProblemsChecklist: {
													where: getActiveStudentFilter(),
												},
											},
										},
									},
								},
							},
						});
					} catch (queryError: any) {
						console.error(
							"❌ Error fetching students with person relation:",
							queryError,
						);
						// Fallback: fetch students without person filter and filter in memory
						const allStudents = await prisma.student.findMany({
							where: getActiveStudentFilter(),
							skip,
							take: limit * 2, // Get more to account for filtering
							orderBy: { studentNumber: "asc" },
							include: {
								person: {
									include: {
										users: {
											where: { type: "student", isDeleted: false },
											include: {
												anxietyAssessments: {
													where: getActiveStudentFilter(),
													orderBy: { assessmentDate: "desc" },
													take: 1,
												},
												stressAssessments: {
													where: getActiveStudentFilter(),
													orderBy: { assessmentDate: "desc" },
													take: 1,
												},
												depressionAssessments: {
													where: getActiveStudentFilter(),
													orderBy: { assessmentDate: "desc" },
													take: 1,
												},
												suicideAssessments: {
													where: getActiveStudentFilter(),
													orderBy: { assessmentDate: "desc" },
													take: 1,
												},
												personalProblemsChecklist: {
													where: getActiveStudentFilter(),
												},
											},
										},
									},
								},
							},
						});
						// Filter in memory to only include students with valid person
						students = allStudents
							.filter((s) => s.person && !s.person.isDeleted)
							.slice(0, limit);
					}

					// Process student data to generate progress insights
					const studentProgressInsights = students
						.map((student: any) => {
							// Safely access person and user data
							if (!student.person) {
								// Convert year to number if it's a string
								const yearValue =
									typeof student.year === "string"
										? parseInt(student.year, 10) || 0
										: student.year || 0;

								return {
									studentId: student.id,
									studentName: student.studentNumber || `Student ${student.id}`,
									studentNumber: student.studentNumber || "",
									program: student.program || "",
									year: yearValue,
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
											message: "No person data found for this student.",
											severity: "medium" as const,
											recommendation:
												"Student record needs to be linked to a person record.",
										},
									],
									riskLevel: "low" as const,
									lastAssessmentDate: null,
								};
							}

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

							// personalProblemsChecklist is a one-to-one relation, so it's a single object, not an array
							const checklist = user.personalProblemsChecklist;
							const checklistCount = checklist ? 1 : 0;
							const latestChecklist = checklist || null;

							const totalAssessments = {
								anxiety: user.anxietyAssessments.length,
								stress: user.stressAssessments.length,
								depression: user.depressionAssessments.length,
								suicide: user.suicideAssessments.length,
								checklist: checklistCount,
								overall:
									user.anxietyAssessments.length +
									user.stressAssessments.length +
									user.depressionAssessments.length +
									user.suicideAssessments.length +
									checklistCount,
							};

							const latestAssessments = {
								anxiety: user.anxietyAssessments[0] || null,
								stress: user.stressAssessments[0] || null,
								depression: user.depressionAssessments[0] || null,
								suicide: user.suicideAssessments[0] || null,
								checklist: latestChecklist,
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
								(latestAssessments.checklist.checklist_analysis.riskLevel ===
									"high" ||
									latestAssessments.checklist.checklist_analysis.riskLevel ===
										"critical")
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
									(latestAssessments.checklist.checklist_analysis.riskLevel ===
										"high" ||
										latestAssessments.checklist.checklist_analysis.riskLevel ===
											"critical"))
							) {
								riskLevel = "high";
							} else if (
								latestAssessments.suicide?.riskLevel === "moderate" ||
								latestAssessments.anxiety?.severityLevel === "moderate" ||
								latestAssessments.depression?.severityLevel === "moderate" ||
								latestAssessments.stress?.severityLevel === "moderate" ||
								(latestAssessments.checklist?.checklist_analysis &&
									latestAssessments.checklist.checklist_analysis.riskLevel ===
										"moderate")
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
												...allDates.map((date) =>
													new Date(date as Date).getTime(),
												),
											),
										)
									: null;

							// Convert year to number if it's a string
							const yearValue =
								typeof student.year === "string"
									? parseInt(student.year, 10) || 0
									: student.year || 0;

							return {
								studentId: student.id,
								studentName:
									`${(student.person as any)?.firstName || ""} ${(student.person as any)?.lastName || ""}`.trim() ||
									student.studentNumber ||
									`Student ${student.id}`,
								studentNumber: student.studentNumber || "",
								program: student.program || "",
								year: yearValue,
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

					return result;
				} catch (error: any) {
					console.error(`❌ Error in studentProgressOverview:`, error);
					console.error(`❌ Error stack:`, error?.stack);

					// Return empty structure instead of throwing to prevent null response
					return {
						students: [],
						summary: {
							totalStudents: 0,
							studentsWithAssessments: 0,
							highRiskStudents: 0,
							moderateRiskStudents: 0,
							lowRiskStudents: 0,
						},
						pagination: {
							page: filter?.page ? Number(filter.page) : 1,
							limit: filter?.limit ? Number(filter.limit) : 10,
							total: 0,
							totalPages: 0,
							hasNextPage: false,
							hasPrevPage: false,
						},
					};
				}
			},
			getAssessmentDetails: async () => {
				console.log(`🔍 API: Getting detailed assessment data`);

				// Extract assessment ID and type from filter
				const assessmentId = filter?.assessmentId;
				const assessmentType = filter?.assessmentType;

				if (!assessmentId || !assessmentType) {
					throw new Error("Assessment ID and type are required");
				}

				console.log(`📋 Fetching ${assessmentType} assessment with ID: ${assessmentId}`);

				let assessmentData = null;

				switch (assessmentType.toLowerCase()) {
					case "anxiety":
						assessmentData = await prisma.anxietyAssessment.findUnique({
							where: { id: assessmentId, isDeleted: false },
							include: {
								user: {
									include: {
										person: true,
									},
								},
							},
						});
						break;

					case "depression":
						assessmentData = await prisma.depressionAssessment.findUnique({
							where: { id: assessmentId, isDeleted: false },
							include: {
								user: {
									include: {
										person: true,
									},
								},
							},
						});
						break;

					case "stress":
						assessmentData = await prisma.stressAssessment.findUnique({
							where: { id: assessmentId, isDeleted: false },
							include: {
								user: {
									include: {
										person: true,
									},
								},
							},
						});
						break;

					case "suicide":
						assessmentData = await prisma.suicideAssessment.findUnique({
							where: { id: assessmentId, isDeleted: false },
							include: {
								user: {
									include: {
										person: true,
									},
								},
							},
						});
						break;

					case "checklist":
						assessmentData = await prisma.personalProblemsChecklist.findUnique({
							where: { id: assessmentId, isDeleted: false },
							include: {
								user: {
									include: {
										person: true,
									},
								},
							},
						});
						break;

					default:
						throw new Error(`Invalid assessment type: ${assessmentType}`);
				}

				if (!assessmentData) {
					throw new Error(`Assessment not found: ${assessmentId}`);
				}

				console.log(`✅ Assessment data retrieved successfully`);
				return assessmentData;
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
							where: getActiveStudentFilter(),
							orderBy: { assessmentDate: "desc" },
						},
						stressAssessments: {
							where: getActiveStudentFilter(),
							orderBy: { assessmentDate: "desc" },
						},
						depressionAssessments: {
							where: getActiveStudentFilter(),
							orderBy: { assessmentDate: "desc" },
						},
						suicideAssessments: {
							where: getActiveStudentFilter(),
							orderBy: { assessmentDate: "desc" },
						},
						personalProblemsChecklist: {
							where: getActiveStudentFilter(),
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
						checklist: user.personalProblemsChecklist
							? {
									...user.personalProblemsChecklist,
									severityLevel:
										user.personalProblemsChecklist.checklist_analysis
											?.riskLevel || "unknown",
									totalScore: user.personalProblemsChecklist.checklist_analysis
										?.categoryScores
										? Object.values(
												user.personalProblemsChecklist.checklist_analysis
													.categoryScores as Record<string, number>,
											).reduce((sum, count) => sum + count, 0)
										: null,
								}
							: null,
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
							totalScore: a.checklist_analysis?.categoryScores
								? Object.values(
										a.checklist_analysis.categoryScores as Record<
											string,
											number
										>,
									).reduce((sum, count) => sum + count, 0)
								: null,
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
					return phtDate.toISOString().split("T")[0];
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
				const groupByDateAndAggregate = (
					assessments: any[],
					dateKey: string,
					scoreKey: string,
					levelKey: string,
				) => {
					// Instead of grouping by date, return each assessment as a separate data point
					// This shows all assessments on the timeline without averaging
					// Convert to Philippine Time (UTC+8)
					return assessments
						.map((assessment) => ({
							date: convertToPHT(new Date(assessment[dateKey])),
							score: assessment[scoreKey] || null,
							level: assessment[levelKey] || "unknown",
							count: 1, // Each individual assessment
						}))
						.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
				};

				// Group suicide assessments individually without averaging
				const groupSuicideByDate = (assessments: any[]) => {
					// Convert to Philippine Time (UTC+8)
					return assessments
						.map((assessment) => ({
							date: convertToPHT(new Date(assessment.assessmentDate)),
							score: null,
							level: assessment.riskLevel || "low",
							requiresIntervention:
								assessment.requires_immediate_intervention || false,
							count: 1, // Each individual assessment
						}))
						.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
				};

				// Group checklist assessments individually without averaging
				const groupChecklistByDate = (assessments: any[]) => {
					return assessments
						.map((assessment) => {
							const problemCount = assessment.checklist_analysis?.categoryScores
								? Object.values(
										assessment.checklist_analysis.categoryScores as Record<
											string,
											number
										>,
									).reduce((sum, count) => sum + count, 0)
								: null;

							return {
								date: convertToPHT(new Date(assessment.date_completed)),
								score: problemCount,
								level: assessment.checklist_analysis?.riskLevel || "unknown",
								count: 1, // Each individual assessment
							};
						})
						.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
				};

				const trends = {
					period: timeRange,
					startDate: convertToPHT(startDate),
					endDate: convertToPHT(endDate),
					anxiety: groupByDateAndAggregate(
						anxietyTrend,
						"assessmentDate",
						"totalScore",
						"severityLevel",
					),
					stress: groupByDateAndAggregate(
						stressTrend,
						"assessmentDate",
						"totalScore",
						"severityLevel",
					),
					depression: groupByDateAndAggregate(
						depressionTrend,
						"assessmentDate",
						"totalScore",
						"severityLevel",
					),
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
				console.log(`🔍 Getting recent trends for ${days} days`);

				const startDate = new Date();
				startDate.setDate(startDate.getDate() - days);

				const dateFilter = {
					assessmentDate: {
						gte: startDate,
					},
				};

				// Get assessments grouped by day
				const [anxietyByDay, depressionByDay, stressByDay, checklistByDay, suicideByDay] =
					await Promise.all([
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

			getProgramDistribution: async (assessmentType?: string) => {
				console.log(`🔍 Getting program distribution, assessmentType: ${assessmentType}`);

				// If specific assessment type is requested, fetch only that type
				if (assessmentType && assessmentType !== "all") {
					let assessments: any[] = [];
					let countField = assessmentType.toLowerCase();

					switch (assessmentType.toLowerCase()) {
						case "anxiety":
							assessments = await prisma.anxietyAssessment.findMany({
								where: {
									isDeleted: false,
									...(filter.userFilter && { user: filter.userFilter }),
								},
								include: {
									user: {
										include: {
											person: {
												include: {
													students: {
														where: getActiveStudentFilter(),
													},
												},
											},
										},
									},
								},
							});
							break;
						case "depression":
							assessments = await prisma.depressionAssessment.findMany({
								where: {
									isDeleted: false,
									...(filter.userFilter && { user: filter.userFilter }),
								},
								include: {
									user: {
										include: {
											person: {
												include: {
													students: {
														where: getActiveStudentFilter(),
													},
												},
											},
										},
									},
								},
							});
							break;
						case "stress":
							assessments = await prisma.stressAssessment.findMany({
								where: {
									isDeleted: false,
									...(filter.userFilter && { user: filter.userFilter }),
								},
								include: {
									user: {
										include: {
											person: {
												include: {
													students: {
														where: getActiveStudentFilter(),
													},
												},
											},
										},
									},
								},
							});
							break;
						case "checklist":
							assessments = await prisma.personalProblemsChecklist.findMany({
								where: {
									isDeleted: false,
									...(filter.userFilter && { user: filter.userFilter }),
								},
								include: {
									user: {
										include: {
											person: {
												include: {
													students: {
														where: getActiveStudentFilter(),
													},
												},
											},
										},
									},
								},
							});
							break;
						case "suicide":
							assessments = await prisma.suicideAssessment.findMany({
								where: {
									isDeleted: false,
									...(filter.userFilter && { user: filter.userFilter }),
								},
								include: {
									user: {
										include: {
											person: {
												include: {
													students: {
														where: getActiveStudentFilter(),
													},
												},
											},
										},
									},
								},
							});
							break;
					}

					// Count unique students per program
					const programStudentSets: Record<string, Set<string>> = {};
					assessments.forEach((assessment: any) => {
						const students = assessment.user?.person?.students || [];
						students.forEach((student: any) => {
							const program = student.program || "Unknown";
							if (!programStudentSets[program]) {
								programStudentSets[program] = new Set();
							}
							programStudentSets[program].add(student.id);
						});
					});

					return Object.entries(programStudentSets).map(([program, studentSet]) => ({
						program,
						[countField]: studentSet.size,
					}));
				}

				// Default behavior: fetch all assessment types
				const [
					anxietyByProgram,
					depressionByProgram,
					stressByProgram,
					checklistByProgram,
					suicideByProgram,
				] = await Promise.all([
					prisma.anxietyAssessment.findMany({
						where: {
							isDeleted: false,
							...(filter.userFilter && { user: filter.userFilter }),
						},
						include: {
							user: {
								include: {
									person: {
										include: {
											students: {
												where: getActiveStudentFilter(),
											},
										},
									},
								},
							},
						},
					}),
					prisma.depressionAssessment.findMany({
						where: {
							isDeleted: false,
							...(filter.userFilter && { user: filter.userFilter }),
						},
						include: {
							user: {
								include: {
									person: {
										include: {
											students: {
												where: getActiveStudentFilter(),
											},
										},
									},
								},
							},
						},
					}),
					prisma.stressAssessment.findMany({
						where: {
							isDeleted: false,
							...(filter.userFilter && { user: filter.userFilter }),
						},
						include: {
							user: {
								include: {
									person: {
										include: {
											students: {
												where: getActiveStudentFilter(),
											},
										},
									},
								},
							},
						},
					}),
					prisma.personalProblemsChecklist.findMany({
						where: {
							isDeleted: false,
							...(filter.userFilter && { user: filter.userFilter }),
						},
						include: {
							user: {
								include: {
									person: {
										include: {
											students: {
												where: getActiveStudentFilter(),
											},
										},
									},
								},
							},
						},
					}),
					prisma.suicideAssessment.findMany({
						where: {
							isDeleted: false,
							...(filter.userFilter && { user: filter.userFilter }),
						},
						include: {
							user: {
								include: {
									person: {
										include: {
											students: {
												where: getActiveStudentFilter(),
											},
										},
									},
								},
							},
						},
					}),
				]);

				// Create maps to track unique students per program for each assessment type
				const programMaps: Record<
					string,
					{
						anxiety: Set<string>;
						depression: Set<string>;
						stress: Set<string>;
						checklist: Set<string>;
						suicide: Set<string>;
					}
				> = {};

				// Helper function to add student to program map
				const addToMap = (
					assessment: any,
					assessmentType: "anxiety" | "depression" | "stress" | "checklist" | "suicide",
				) => {
					const students = assessment.user?.person?.students || [];
					students.forEach((student: any) => {
						const program = student.program || "Unknown";
						if (!programMaps[program]) {
							programMaps[program] = {
								anxiety: new Set(),
								depression: new Set(),
								stress: new Set(),
								checklist: new Set(),
								suicide: new Set(),
							};
						}
						programMaps[program][assessmentType].add(student.id);
					});
				};

				// Process each assessment type
				anxietyByProgram.forEach((a) => addToMap(a, "anxiety"));
				depressionByProgram.forEach((d) => addToMap(d, "depression"));
				stressByProgram.forEach((s) => addToMap(s, "stress"));
				checklistByProgram.forEach((c) => addToMap(c, "checklist"));
				suicideByProgram.forEach((s) => addToMap(s, "suicide"));

				// Convert to array format
				return Object.entries(programMaps).map(([program, sets]) => ({
					program,
					anxiety: sets.anxiety.size,
					depression: sets.depression.size,
					stress: sets.stress.size,
					checklist: sets.checklist.size,
					suicide: sets.suicide.size,
				}));
			},
		},
		Inventory: {
			totalInventory: async () => {
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

					console.log(`🔍 API: Inventory date filter applied`);
					console.log(`📅 Start Date: ${startDate.toISOString()}`);
					if (endDate) console.log(`📅 End Date: ${endDate.toISOString()}`);
				}

				const count = await prisma.individualInventory.count({
					where: {
						isDeleted: false,
						...dateFilter,
					},
				});

				console.log(`📊 Inventory count result: ${count}`);
				return count;
			},

			availableYears: async () => {
				const inventories = await prisma.individualInventory.findMany({
					where: {
						isDeleted: false,
					},
					select: {
						createdAt: true,
					},
				});

				const years = new Set<number>();
				inventories.forEach((inventory) => {
					if (inventory.createdAt) {
						years.add(inventory.createdAt.getFullYear());
					}
				});

				return Array.from(years).sort((a, b) => b - a);
			},

			totalInventoryByProgram: async () => {
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
				}

				const inventoriesWithProgram = await prisma.individualInventory.findMany({
					where: {
						isDeleted: false,
						...dateFilter,
					},
					include: {
						student: {
							include: {
								person: true,
							},
						},
					},
				});

				const programCounts: Record<string, number> = {};
				inventoriesWithProgram.forEach((inventory) => {
					const program = inventory.student?.program || "Unknown";
					programCounts[program] = (programCounts[program] || 0) + 1;
				});

				return Object.entries(programCounts).map(([program, count]) => ({
					program,
					count,
				}));
			},

			totalInventoryByYear: async () => {
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
				}

				const inventoriesWithYear = await prisma.individualInventory.findMany({
					where: {
						isDeleted: false,
						...dateFilter,
					},
					include: {
						student: {
							include: {
								person: true,
							},
						},
					},
				});

				const yearCounts: Record<string, number> = {};
				inventoriesWithYear.forEach((inventory) => {
					const year = inventory.student?.year || "Unknown";
					yearCounts[year] = (yearCounts[year] || 0) + 1;
				});

				return Object.entries(yearCounts).map(([year, count]) => ({
					year,
					count,
				}));
			},

			totalInventoryByGender: async () => {
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
				}

				const inventoriesWithGender = await prisma.individualInventory.findMany({
					where: {
						isDeleted: false,
						...dateFilter,
					},
					include: {
						student: {
							include: {
								person: true,
							},
						},
					},
				});

				const genderCounts: Record<string, number> = {};
				inventoriesWithGender.forEach((inventory) => {
					const gender = inventory.student?.person?.gender || "Unknown";
					genderCounts[gender] = (genderCounts[gender] || 0) + 1;
				});

				return Object.entries(genderCounts).map(([gender, count]) => ({
					gender,
					count,
				}));
			},

			mentalHealthPredictionDistribution: async () => {
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
				}

				const inventories = await prisma.individualInventory.findMany({
					where: {
						isDeleted: false,
						predictionGenerated: true,
						...dateFilter,
					},
					include: {
						mentalHealthPredictions: {
							where: getActiveStudentFilter(),
							orderBy: { predictionDate: "desc" },
							take: 1,
						},
					},
				});

				const riskCounts: Record<string, number> = {
					"Low Risk": 0,
					"Moderate Risk": 0,
					"High Risk": 0,
					"Critical Risk": 0,
				};

				inventories.forEach((inventory) => {
					const latestPrediction = inventory.mentalHealthPredictions[0];
					if (latestPrediction?.mentalHealthRisk) {
						const risk = latestPrediction.mentalHealthRisk.level;
						if (risk === "low") riskCounts["Low Risk"]++;
						else if (risk === "moderate") riskCounts["Moderate Risk"]++;
						else if (risk === "high") riskCounts["High Risk"]++;
						else if (risk === "critical") riskCounts["Critical Risk"]++;
					}
				});

				return Object.entries(riskCounts).map(([risk, count]) => ({
					risk,
					count,
				}));
			},

			bmiCategoryDistribution: async () => {
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
				}

				const inventories = await prisma.individualInventory.findMany({
					where: {
						isDeleted: false,
						...dateFilter,
					},
					select: {
						height: true,
						weight: true,
					},
				});

				const bmiCounts: Record<string, number> = {
					Underweight: 0,
					Normal: 0,
					Overweight: 0,
					Obese: 0,
					Unknown: 0,
				};

				const calculateBMICategory = (height: string, weight: string): string => {
					try {
						let heightInMeters: number;
						let weightInKg: number;
						let isImperialHeight = false;

						// Check if height is in feet'inches format (e.g., "5'7")
						if (height.includes("'")) {
							isImperialHeight = true;
							const [feet, inches] = height
								.split("'")
								.map((s) => parseFloat(s.replace(/[^0-9.]/g, "")));
							if (isNaN(feet) || isNaN(inches)) return "Unknown";
							// Convert feet and inches to meters: (feet * 12 + inches) * 0.0254
							heightInMeters = (feet * 12 + inches) * 0.0254;
						} else {
							// Assume height is in centimeters
							heightInMeters = parseFloat(height) / 100;
						}

						// Parse weight value
						const weightValue = parseFloat(weight.replace(/[^0-9.]/g, ""));
						if (isNaN(weightValue)) return "Unknown";

						// If height is imperial (feet/inches), assume weight is in pounds too
						// Otherwise check for explicit lb/pound indicators or very high values (> 200)
						if (
							isImperialHeight ||
							weight.toLowerCase().includes("lb") ||
							weight.toLowerCase().includes("pound") ||
							weightValue > 200
						) {
							weightInKg = weightValue * 0.453592; // Convert pounds to kg
						} else {
							weightInKg = weightValue; // Assume already in kg
						}

						if (heightInMeters <= 0 || weightInKg <= 0) return "Unknown";

						const bmi = weightInKg / (heightInMeters * heightInMeters);

						if (bmi < 18.5) return "Underweight";
						if (bmi < 25) return "Normal";
						if (bmi < 30) return "Overweight";
						return "Obese";
					} catch (error) {
						return "Unknown";
					}
				};

				inventories.forEach((inventory) => {
					const category = calculateBMICategory(inventory.height, inventory.weight);
					bmiCounts[category]++;
				});

				return Object.entries(bmiCounts)
					.filter(([_, count]) => count > 0)
					.map(([category, count]) => ({
						category,
						count,
					}));
			},

			mentalHealthPredictionByProgram: async () => {
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
				}

				const inventories = await prisma.individualInventory.findMany({
					where: {
						isDeleted: false,
						predictionGenerated: true,
						...dateFilter,
					},
					include: {
						student: {
							include: {
								person: true,
							},
						},
						mentalHealthPredictions: {
							where: getActiveStudentFilter(),
							orderBy: { predictionDate: "desc" },
							take: 1,
						},
					},
				});

				// Normalize the risk level filter (convert display format to database format)
				let normalizedRiskLevel: string | undefined = undefined;
				if (filter.riskLevel) {
					const riskLower = filter.riskLevel.toLowerCase();
					if (riskLower.includes("low")) normalizedRiskLevel = "low";
					else if (riskLower.includes("moderate")) normalizedRiskLevel = "moderate";
					else if (riskLower.includes("high")) normalizedRiskLevel = "high";
					else if (riskLower.includes("critical")) normalizedRiskLevel = "critical";
				}

				const programRiskCounts: Record<string, Record<string, number>> = {};

				inventories.forEach((inventory) => {
					const program = inventory.student?.program || "Unknown";
					const latestPrediction = inventory.mentalHealthPredictions[0];

					if (latestPrediction?.mentalHealthRisk) {
						const risk = latestPrediction.mentalHealthRisk.level;

						// If risk level filter is set, only count matching risk levels
						if (normalizedRiskLevel && risk !== normalizedRiskLevel) {
							return; // Skip this inventory if it doesn't match the filter
						}

						if (!programRiskCounts[program]) {
							programRiskCounts[program] = {
								"Low Risk": 0,
								"Moderate Risk": 0,
								"High Risk": 0,
								"Critical Risk": 0,
							};
						}

						if (risk === "low") programRiskCounts[program]["Low Risk"]++;
						else if (risk === "moderate") programRiskCounts[program]["Moderate Risk"]++;
						else if (risk === "high") programRiskCounts[program]["High Risk"]++;
						else if (risk === "critical") programRiskCounts[program]["Critical Risk"]++;
					}
				});

				return Object.entries(programRiskCounts).map(([program, risks]) => ({
					program,
					risks,
					total: Object.values(risks).reduce((sum, count) => sum + count, 0),
				}));
			},

			mentalHealthPredictionByYear: async () => {
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
				}

				// Build where clause for filtering by program
				let whereClause: any = {
					isDeleted: false,
					predictionGenerated: true,
					...dateFilter,
				};

				if (filter.program) {
					whereClause.student = {
						program: filter.program,
						isDeleted: false,
					};
				}

				const inventories = await prisma.individualInventory.findMany({
					where: whereClause,
					include: {
						student: {
							include: {
								person: true,
							},
						},
						mentalHealthPredictions: {
							where: getActiveStudentFilter(),
							orderBy: { predictionDate: "desc" },
							take: 1,
						},
					},
				});

				// Normalize the risk level filter (convert display format to database format)
				let normalizedRiskLevel: string | undefined = undefined;
				if (filter.riskLevel) {
					const riskLower = filter.riskLevel.toLowerCase();
					if (riskLower.includes("low")) normalizedRiskLevel = "low";
					else if (riskLower.includes("moderate")) normalizedRiskLevel = "moderate";
					else if (riskLower.includes("high")) normalizedRiskLevel = "high";
					else if (riskLower.includes("critical")) normalizedRiskLevel = "critical";
				}

				const yearRiskCounts: Record<string, Record<string, number>> = {};

				inventories.forEach((inventory) => {
					const year = inventory.student?.year || "Unknown";
					const latestPrediction = inventory.mentalHealthPredictions[0];

					if (latestPrediction?.mentalHealthRisk) {
						const risk = latestPrediction.mentalHealthRisk.level;

						// If risk level filter is set, only count matching risk levels
						if (normalizedRiskLevel && risk !== normalizedRiskLevel) {
							return; // Skip this inventory if it doesn't match the filter
						}

						if (!yearRiskCounts[year]) {
							yearRiskCounts[year] = {
								"Low Risk": 0,
								"Moderate Risk": 0,
								"High Risk": 0,
								"Critical Risk": 0,
							};
						}

						if (risk === "low") yearRiskCounts[year]["Low Risk"]++;
						else if (risk === "moderate") yearRiskCounts[year]["Moderate Risk"]++;
						else if (risk === "high") yearRiskCounts[year]["High Risk"]++;
						else if (risk === "critical") yearRiskCounts[year]["Critical Risk"]++;
					}
				});

				return Object.entries(yearRiskCounts).map(([year, risks]) => ({
					year,
					risks,
					total: Object.values(risks).reduce((sum, count) => sum + count, 0),
				}));
			},

			mentalHealthPredictionByGender: async () => {
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
				}

				// Build where clause for filtering by program and year
				let whereClause: any = {
					isDeleted: false,
					predictionGenerated: true,
					...dateFilter,
				};

				// Add student filters if provided
				if (filter.program || filter.yearLevel) {
					whereClause.student = {
						isDeleted: false,
						...(filter.program && { program: filter.program }),
						...(filter.yearLevel && { year: filter.yearLevel }),
					};
				}

				const inventories = await prisma.individualInventory.findMany({
					where: whereClause,
					include: {
						student: {
							include: {
								person: true,
							},
						},
						mentalHealthPredictions: {
							where: getActiveStudentFilter(),
							orderBy: { predictionDate: "desc" },
							take: 1,
						},
					},
				});

				// Normalize the risk level filter (convert display format to database format)
				let normalizedRiskLevel: string | undefined = undefined;
				if (filter.riskLevel) {
					const riskLower = filter.riskLevel.toLowerCase();
					if (riskLower.includes("low")) normalizedRiskLevel = "low";
					else if (riskLower.includes("moderate")) normalizedRiskLevel = "moderate";
					else if (riskLower.includes("high")) normalizedRiskLevel = "high";
					else if (riskLower.includes("critical")) normalizedRiskLevel = "critical";
				}

				const genderRiskCounts: Record<string, Record<string, number>> = {};

				inventories.forEach((inventory) => {
					const gender = inventory.student?.person?.gender || "Unknown";
					const latestPrediction = inventory.mentalHealthPredictions[0];

					if (latestPrediction?.mentalHealthRisk) {
						const risk = latestPrediction.mentalHealthRisk.level;

						// If risk level filter is set, only count matching risk levels
						if (normalizedRiskLevel && risk !== normalizedRiskLevel) {
							return; // Skip this inventory if it doesn't match the filter
						}

						if (!genderRiskCounts[gender]) {
							genderRiskCounts[gender] = {
								"Low Risk": 0,
								"Moderate Risk": 0,
								"High Risk": 0,
								"Critical Risk": 0,
							};
						}

						if (risk === "low") genderRiskCounts[gender]["Low Risk"]++;
						else if (risk === "moderate") genderRiskCounts[gender]["Moderate Risk"]++;
						else if (risk === "high") genderRiskCounts[gender]["High Risk"]++;
						else if (risk === "critical") genderRiskCounts[gender]["Critical Risk"]++;
					}
				});

				return Object.entries(genderRiskCounts).map(([gender, risks]) => ({
					gender,
					risks,
					total: Object.values(risks).reduce((sum, count) => sum + count, 0),
				}));
			},

			bmiCategoryByProgram: async () => {
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
				}

				const inventories = await prisma.individualInventory.findMany({
					where: {
						isDeleted: false,
						...dateFilter,
					},
					include: {
						student: {
							include: {
								person: true,
							},
						},
					},
				});

				const programBMICounts: Record<string, Record<string, number>> = {};

				const calculateBMICategory = (height: string, weight: string): string => {
					try {
						let heightInMeters: number;
						let weightInKg: number;
						let isImperialHeight = false;

						// Check if height is in feet'inches format (e.g., "5'7")
						if (height.includes("'")) {
							isImperialHeight = true;
							const [feet, inches] = height
								.split("'")
								.map((s) => parseFloat(s.replace(/[^0-9.]/g, "")));
							if (isNaN(feet) || isNaN(inches)) return "Unknown";
							// Convert feet and inches to meters: (feet * 12 + inches) * 0.0254
							heightInMeters = (feet * 12 + inches) * 0.0254;
						} else {
							// Assume height is in centimeters
							heightInMeters = parseFloat(height) / 100;
						}

						// Parse weight value
						const weightValue = parseFloat(weight.replace(/[^0-9.]/g, ""));
						if (isNaN(weightValue)) return "Unknown";

						// If height is imperial (feet/inches), assume weight is in pounds too
						// Otherwise check for explicit lb/pound indicators or very high values (> 200)
						if (
							isImperialHeight ||
							weight.toLowerCase().includes("lb") ||
							weight.toLowerCase().includes("pound") ||
							weightValue > 200
						) {
							weightInKg = weightValue * 0.453592; // Convert pounds to kg
						} else {
							weightInKg = weightValue; // Assume already in kg
						}

						if (heightInMeters <= 0 || weightInKg <= 0) return "Unknown";

						const bmi = weightInKg / (heightInMeters * heightInMeters);

						if (bmi < 18.5) return "Underweight";
						if (bmi < 25) return "Normal";
						if (bmi < 30) return "Overweight";
						return "Obese";
					} catch (error) {
						return "Unknown";
					}
				};

				inventories.forEach((inventory) => {
					const program = inventory.student?.program || "Unknown";

					const category = calculateBMICategory(inventory.height, inventory.weight);

					// If BMI category filter is set, only count matching categories
					if (filter.bmiCategory && category !== filter.bmiCategory) {
						return; // Skip this inventory if it doesn't match the filter
					}

					if (!programBMICounts[program]) {
						programBMICounts[program] = {
							Underweight: 0,
							Normal: 0,
							Overweight: 0,
							Obese: 0,
						};
					}

					if (category !== "Unknown") {
						programBMICounts[program][category]++;
					}
				});

				return Object.entries(programBMICounts).map(([program, categories]) => ({
					program,
					categories,
					total: Object.values(categories).reduce((sum, count) => sum + count, 0),
				}));
			},

			bmiCategoryByYear: async () => {
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
				}

				// Build where clause for filtering by program
				let whereClause: any = {
					isDeleted: false,
					...dateFilter,
				};

				if (filter.program) {
					whereClause.student = {
						program: filter.program,
						isDeleted: false,
					};
				}

				const inventories = await prisma.individualInventory.findMany({
					where: whereClause,
					include: {
						student: {
							include: {
								person: true,
							},
						},
					},
				});

				const yearBMICounts: Record<string, Record<string, number>> = {};

				const calculateBMICategory = (height: string, weight: string): string => {
					try {
						let heightInMeters: number;
						let weightInKg: number;
						let isImperialHeight = false;

						// Check if height is in feet'inches format (e.g., "5'7")
						if (height.includes("'")) {
							isImperialHeight = true;
							const [feet, inches] = height
								.split("'")
								.map((s) => parseFloat(s.replace(/[^0-9.]/g, "")));
							if (isNaN(feet) || isNaN(inches)) return "Unknown";
							// Convert feet and inches to meters: (feet * 12 + inches) * 0.0254
							heightInMeters = (feet * 12 + inches) * 0.0254;
						} else {
							// Assume height is in centimeters
							heightInMeters = parseFloat(height) / 100;
						}

						// Parse weight value
						const weightValue = parseFloat(weight.replace(/[^0-9.]/g, ""));
						if (isNaN(weightValue)) return "Unknown";

						// If height is imperial (feet/inches), assume weight is in pounds too
						// Otherwise check for explicit lb/pound indicators or very high values (> 200)
						if (
							isImperialHeight ||
							weight.toLowerCase().includes("lb") ||
							weight.toLowerCase().includes("pound") ||
							weightValue > 200
						) {
							weightInKg = weightValue * 0.453592; // Convert pounds to kg
						} else {
							weightInKg = weightValue; // Assume already in kg
						}

						if (heightInMeters <= 0 || weightInKg <= 0) return "Unknown";

						const bmi = weightInKg / (heightInMeters * heightInMeters);

						if (bmi < 18.5) return "Underweight";
						if (bmi < 25) return "Normal";
						if (bmi < 30) return "Overweight";
						return "Obese";
					} catch (error) {
						return "Unknown";
					}
				};

				inventories.forEach((inventory) => {
					const year = inventory.student?.year || "Unknown";

					const category = calculateBMICategory(inventory.height, inventory.weight);

					// If BMI category filter is set, only count matching categories
					if (filter.bmiCategory && category !== filter.bmiCategory) {
						return; // Skip this inventory if it doesn't match the filter
					}

					if (!yearBMICounts[year]) {
						yearBMICounts[year] = {
							Underweight: 0,
							Normal: 0,
							Overweight: 0,
							Obese: 0,
						};
					}

					if (category !== "Unknown") {
						yearBMICounts[year][category]++;
					}
				});

				return Object.entries(yearBMICounts).map(([year, categories]) => ({
					year,
					categories,
					total: Object.values(categories).reduce((sum, count) => sum + count, 0),
				}));
			},

			bmiCategoryByGender: async () => {
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
				}

				// Build where clause for filtering by program and year
				let whereClause: any = {
					isDeleted: false,
					...dateFilter,
				};

				// Add student filters if provided
				if (filter.program || filter.yearLevel) {
					whereClause.student = {
						isDeleted: false,
						...(filter.program && { program: filter.program }),
						...(filter.yearLevel && { year: filter.yearLevel }),
					};
				}

				const inventories = await prisma.individualInventory.findMany({
					where: whereClause,
					include: {
						student: {
							include: {
								person: true,
							},
						},
					},
				});

				const genderBMICounts: Record<string, Record<string, number>> = {};

				const calculateBMICategory = (height: string, weight: string): string => {
					try {
						let heightInMeters: number;
						let weightInKg: number;
						let isImperialHeight = false;

						// Check if height is in feet'inches format (e.g., "5'7")
						if (height.includes("'")) {
							isImperialHeight = true;
							const [feet, inches] = height
								.split("'")
								.map((s) => parseFloat(s.replace(/[^0-9.]/g, "")));
							if (isNaN(feet) || isNaN(inches)) return "Unknown";
							// Convert feet and inches to meters: (feet * 12 + inches) * 0.0254
							heightInMeters = (feet * 12 + inches) * 0.0254;
						} else {
							// Assume height is in centimeters
							heightInMeters = parseFloat(height) / 100;
						}

						// Parse weight value
						const weightValue = parseFloat(weight.replace(/[^0-9.]/g, ""));
						if (isNaN(weightValue)) return "Unknown";

						// If height is imperial (feet/inches), assume weight is in pounds too
						// Otherwise check for explicit lb/pound indicators or very high values (> 200)
						if (
							isImperialHeight ||
							weight.toLowerCase().includes("lb") ||
							weight.toLowerCase().includes("pound") ||
							weightValue > 200
						) {
							weightInKg = weightValue * 0.453592; // Convert pounds to kg
						} else {
							weightInKg = weightValue; // Assume already in kg
						}

						if (heightInMeters <= 0 || weightInKg <= 0) return "Unknown";

						const bmi = weightInKg / (heightInMeters * heightInMeters);

						if (bmi < 18.5) return "Underweight";
						if (bmi < 25) return "Normal";
						if (bmi < 30) return "Overweight";
						return "Obese";
					} catch (error) {
						return "Unknown";
					}
				};

				inventories.forEach((inventory) => {
					const gender = inventory.student?.person?.gender || "Unknown";

					const category = calculateBMICategory(inventory.height, inventory.weight);

					// If BMI category filter is set, only count matching categories
					if (filter.bmiCategory && category !== filter.bmiCategory) {
						return; // Skip this inventory if it doesn't match the filter
					}

					if (!genderBMICounts[gender]) {
						genderBMICounts[gender] = {
							Underweight: 0,
							Normal: 0,
							Overweight: 0,
							Obese: 0,
						};
					}

					if (category !== "Unknown") {
						genderBMICounts[gender][category]++;
					}
				});

				return Object.entries(genderBMICounts).map(([gender, categories]) => ({
					gender,
					categories,
					total: Object.values(categories).reduce((sum, count) => sum + count, 0),
				}));
			},

			inventoryStudentList: async () => {
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
				}

				// Build where clause with all filters
				let whereClause: any = {
					isDeleted: false,
					predictionGenerated: true,
					...dateFilter,
				};

				// Build student filter
				const studentFilter: any = { isDeleted: false };
				if (filter.program) studentFilter.program = filter.program;
				if (filter.yearLevel) studentFilter.year = filter.yearLevel;
				if (filter.gender) {
					// Gender is on the person, need to handle this differently
					whereClause.student = {
						...studentFilter,
						person: {
							gender: filter.gender,
						},
					};
				} else if (filter.program || filter.yearLevel) {
					whereClause.student = studentFilter;
				}

				const inventories = await prisma.individualInventory.findMany({
					where: whereClause,
					include: {
						student: {
							include: {
								person: true,
							},
						},
						mentalHealthPredictions: {
							where: getActiveStudentFilter(),
							orderBy: { predictionDate: "desc" },
							take: 1,
						},
					},
					orderBy: {
						createdAt: "desc",
					},
				});

				// Normalize the risk level filter (convert display format to database format)
				let normalizedRiskLevel: string | undefined = undefined;
				if (filter.riskLevel) {
					const riskLower = filter.riskLevel.toLowerCase();
					if (riskLower.includes("low")) normalizedRiskLevel = "low";
					else if (riskLower.includes("moderate")) normalizedRiskLevel = "moderate";
					else if (riskLower.includes("high")) normalizedRiskLevel = "high";
					else if (riskLower.includes("critical")) normalizedRiskLevel = "critical";
				}

				// Calculate BMI category
				const calculateBMICategory = (height: string, weight: string): string => {
					try {
						let heightInMeters: number;
						let weightInKg: number;
						let isImperialHeight = false;

						// Check if height is in feet'inches format (e.g., "5'7")
						if (height.includes("'")) {
							isImperialHeight = true;
							const [feet, inches] = height
								.split("'")
								.map((s) => parseFloat(s.replace(/[^0-9.]/g, "")));
							if (isNaN(feet) || isNaN(inches)) return "Unknown";
							// Convert feet and inches to meters: (feet * 12 + inches) * 0.0254
							heightInMeters = (feet * 12 + inches) * 0.0254;
						} else {
							// Assume height is in centimeters
							heightInMeters = parseFloat(height) / 100;
						}

						// Parse weight value
						const weightValue = parseFloat(weight.replace(/[^0-9.]/g, ""));
						if (isNaN(weightValue)) return "Unknown";

						// If height is imperial (feet/inches), assume weight is in pounds too
						// Otherwise check for explicit lb/pound indicators or very high values (> 200)
						if (
							isImperialHeight ||
							weight.toLowerCase().includes("lb") ||
							weight.toLowerCase().includes("pound") ||
							weightValue > 200
						) {
							weightInKg = weightValue * 0.453592; // Convert pounds to kg
						} else {
							weightInKg = weightValue; // Assume already in kg
						}

						if (heightInMeters <= 0 || weightInKg <= 0) return "Unknown";

						const bmi = weightInKg / (heightInMeters * heightInMeters);

						if (bmi < 18.5) return "Underweight";
						if (bmi < 25) return "Normal";
						if (bmi < 30) return "Overweight";
						return "Obese";
					} catch (error) {
						return "Unknown";
					}
				};

				return inventories
					.filter((inventory) => {
						// Filter by risk level if specified
						if (normalizedRiskLevel) {
							const latestPrediction = inventory.mentalHealthPredictions?.[0];
							const risk = latestPrediction?.mentalHealthRisk?.level;
							if (risk !== normalizedRiskLevel) return false;
						}

						// Filter by BMI category if specified
						if (filter.bmiCategory) {
							const bmiCat = calculateBMICategory(inventory.height, inventory.weight);
							if (bmiCat !== filter.bmiCategory) return false;
						}

						return true;
					})
					.map((inventory) => {
						const latestPrediction = inventory.mentalHealthPredictions?.[0];
						return {
							id: inventory.id,
							studentId: inventory.student?.id, // Add student ID for frontend lookups
							studentNumber: inventory.student?.studentNumber || "N/A",
							firstName: inventory.student?.person?.firstName || "",
							lastName: inventory.student?.person?.lastName || "",
							email: inventory.student?.person?.email || "N/A",
							program: inventory.student?.program || "N/A",
							year: inventory.student?.year || "N/A",
							gender: inventory.student?.person?.gender || "N/A",
							mentalHealthPrediction: latestPrediction?.mentalHealthRisk?.level
								? `${latestPrediction.mentalHealthRisk.level.charAt(0).toUpperCase()}${latestPrediction.mentalHealthRisk.level.slice(1)} Risk`
								: "N/A",
							bmiCategory: calculateBMICategory(inventory.height, inventory.weight),
							createdAt: inventory.createdAt,
						};
					});
			},

			inventoryStats: async () => {
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
				}

				const inventories = await prisma.individualInventory.findMany({
					where: {
						isDeleted: false,
						...dateFilter,
					},
					include: {
						mentalHealthPredictions: {
							where: getActiveStudentFilter(),
							orderBy: { predictionDate: "desc" },
							take: 1,
						},
					},
				});

				const totalRecords = inventories.length;

				// Count high risk (includes high and critical)
				const highRiskCount = inventories.filter((inv) => {
					const latestPrediction = inv.mentalHealthPredictions?.[0];
					const risk = latestPrediction?.mentalHealthRisk?.level;
					return risk === "high" || risk === "critical";
				}).length;

				// Calculate completion rate (inventories with predictions)
				const completedPredictions = inventories.filter(
					(inv) => inv.predictionGenerated,
				).length;
				const completionRate =
					totalRecords > 0 ? Math.round((completedPredictions / totalRecords) * 100) : 0;

				// Calculate average BMI
				let totalBMI = 0;
				let validBMICount = 0;

				inventories.forEach((inv) => {
					try {
						const heightInMeters = parseFloat(inv.height) / 100;
						const weightInKg = parseFloat(inv.weight);
						if (heightInMeters > 0 && weightInKg > 0) {
							const bmi = weightInKg / (heightInMeters * heightInMeters);
							if (bmi > 0 && bmi < 100) {
								// Sanity check
								totalBMI += bmi;
								validBMICount++;
							}
						}
					} catch (error) {
						// Skip invalid entries
					}
				});

				const avgBmi = validBMICount > 0 ? totalBMI / validBMICount : 0;

				return {
					totalRecords,
					highRiskCount,
					completionRate,
					avgBmi: Math.round(avgBmi * 10) / 10, // Round to 1 decimal
				};
			},
		},
	};
};
