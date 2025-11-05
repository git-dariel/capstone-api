import { PrismaClient } from "../generated/prisma";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

// Helper functions
const getRandomElement = <T>(array: T[]): T => {
	return array[Math.floor(Math.random() * array.length)];
};

const getRandomInt = (min: number, max: number): number => {
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Data arrays for randomization
const firstNames = [
	"Juan", "Maria", "Jose", "Ana", "Pedro", "Sofia", "Miguel", "Isabella",
	"Carlos", "Gabriela", "Luis", "Valentina", "Antonio", "Camila", "Rafael",
	"Andrea", "Manuel", "Lucia", "Diego", "Elena", "Fernando", "Carmen",
	"Roberto", "Patricia", "Jorge", "Rosa", "Ricardo", "Laura", "Pablo",
	"Monica", "Angel", "Teresa", "Marco", "Diana", "Sergio", "Beatriz",
	"Alberto", "Sandra", "Victor", "Veronica", "Alejandro", "Cristina",
	"Daniel", "Alicia", "Francisco", "Natalia", "Eduardo", "Julia", "Oscar",
	"Adriana", "Raul", "Claudia", "Emilio", "Silvia"
];

const lastNames = [
	"Garcia", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
	"Perez", "Sanchez", "Ramirez", "Torres", "Flores", "Rivera", "Cruz",
	"Gomez", "Morales", "Reyes", "Gutierrez", "Ortiz", "Chavez", "Ramos",
	"Castillo", "Mendoza", "Santos", "Vargas", "Castro", "Romero", "Suarez",
	"Alvarez", "Jimenez", "Navarro", "Rojas", "Diaz", "Fernandez", "Medina",
	"Aguilar", "Guerrero", "Cortez", "Silva", "Nunez", "Espinoza"
];

const programs = ["bsit", "bscs", "dcpet", "bsba", "bsed", "beed", "bsce"];
const years = ["1st", "2nd", "3rd", "4th"];
const academicStatus = ["freshman", "sophomore", "junior", "senior"];
const cities = ["Manila", "Quezon City", "Caloocan", "Makati", "Pasig", "Taguig", "Paranaque", "Las Pinas", "Muntinlupa", "Macalelon"];
const provinces = ["Metro Manila", "Quezon Province", "Rizal", "Cavite", "Laguna"];
const religions = ["Catholic", "Protestant", "Islam", "Buddhism", "Others"];

// Assessment response options
const frequencyOptions = ["not_at_all", "several_days", "more_than_half_days", "nearly_every_day"];
const stressOptions = ["never", "almost_never", "sometimes", "fairly_often", "very_often"];
const difficultyOptions = ["not_difficult_at_all", "somewhat_difficult", "very_difficult", "extremely_difficult"];
const concernLevels = ["not_applicable", "least_important", "somewhat_important", "important", "very_important", "most_important"];
const referredOptions = ["self", "family", "friend", "faculty", "administrative_staff", "others"];
const liveOptions = ["alone", "spouse", "partner", "roommates", "children", "guardians"];
const financialOptions = ["always_stressful", "often_stressful", "never_stressful", "sometimes_stressful", "rarely_stressful"];
const servicesOptions = ["general_information", "one_or_two_session_problem_solving", "stress_management", "group_counseling", "substance_abuse_services", "career_exploration", "individual_counseling", "referral_for_university"];
const physicalSymptoms = ["shortness_of_breath", "racing_heart", "headaches", "insomnia", "teeth_clenching", "cold_hands_and_feet", "high_blood_pressure", "muscle_tension", "diarrhea", "stomach_discomfort"];

// Calculate severity levels
const calculateAnxietySeverity = (score: number): string => {
	if (score <= 4) return "minimal";
	if (score <= 9) return "mild";
	if (score <= 14) return "moderate";
	return "severe";
};

const calculateDepressionSeverity = (score: number): string => {
	if (score <= 4) return "minimal";
	if (score <= 9) return "mild";
	if (score <= 14) return "moderate";
	if (score <= 19) return "moderately_severe";
	return "severe";
};

const calculateStressSeverity = (score: number): string => {
	if (score <= 13) return "low";
	if (score <= 26) return "moderate";
	return "high";
};

const scoreMapping: { [key: string]: number } = {
	"not_at_all": 0,
	"several_days": 1,
	"more_than_half_days": 2,
	"nearly_every_day": 3,
	"never": 0,
	"almost_never": 1,
	"sometimes": 2,
	"fairly_often": 3,
	"very_often": 4
};

async function main() {
	console.log("Starting seed process...");

	// Create 50 students with complete data
	for (let i = 1; i <= 50; i++) {
		const firstName = getRandomElement(firstNames);
		const lastName = getRandomElement(lastNames);
		const timestamp = Date.now();
		const studentNumber = `2024-${String(i + timestamp % 10000).padStart(5, "0")}-LQ-${getRandomInt(0, 9)}`;
		const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}${timestamp}@iskolarngbayan.pup.edu.ph`;
		const contactNumber = `09${getRandomInt(100000000, 999999999)}`;
		const gender = getRandomElement(["male", "female"]) as "male" | "female";

		console.log(`Creating student ${i}/50: ${firstName} ${lastName}`);

		try {
			// Create Person
			const person = await prisma.person.create({
				data: {
					firstName,
					lastName,
					middleName: getRandomElement(firstNames),
					contactNumber,
					email,
					gender,
					birthDate: new Date(getRandomInt(1998, 2006), getRandomInt(0, 11), getRandomInt(1, 28)),
					age: getRandomInt(18, 26),
					religion: getRandomElement(religions),
					civilStatus: "single",
					address: {
						street: `${getRandomInt(1, 999)} ${getRandomElement(["Main", "Oak", "Maple", "Pine"])} St`,
						city: getRandomElement(cities),
						province: getRandomElement(provinces),
						zipCode: getRandomInt(1000, 9999),
						barangay: `Barangay ${getRandomInt(1, 50)}`,
						country: "Philippines",
						type: "current"
					},
					guardian: {
						firstName: getRandomElement(firstNames),
						lastName,
						middleName: getRandomElement(firstNames),
						contactNumber: `09${getRandomInt(100000000, 999999999)}`,
						relationship: gender === "male" ? "mother" : "father"
					}
				}
			});

			// Create User
			const hashedPassword = await bcrypt.hash("password123", 10);
			const user = await prisma.user.create({
				data: {
					personId: person.id,
					userName: email,
					password: hashedPassword,
					role: "user",
					type: "student",
					status: "active",
					emailVerified: true,
					loginMethod: "email",
					lastLogin: new Date()
				}
			});

			// Create Student
			const student = await prisma.student.create({
				data: {
					studentNumber,
					program: getRandomElement(programs),
					year: getRandomElement(years),
					status: getRandomElement(academicStatus) as "freshman" | "sophomore" | "junior" | "senior",
					personId: person.id,
					notes: getRandomInt(0, 3) > 0 ? [
						{
							title: "Consultation Note",
							content: "Student showed good progress in managing stress levels."
						}
					] : []
				}
			});

			// Create Consent
			await prisma.consent.create({
				data: {
					studentId: student.id,
					referred: getRandomElement(referredOptions) as any,
					with_whom_do_you_live: getRandomElement(liveOptions) as any,
					financial_status: getRandomElement(financialOptions) as any,
					what_brings_you_to_guidance: "Seeking guidance for academic and personal growth",
					physical_problem: getRandomElement(["yes", "no"]) as "yes" | "no",
					physical_symptoms: getRandomElement(physicalSymptoms) as any,
					services: getRandomElement(servicesOptions) as any,
					concerns: {
						personal_growth: getRandomElement(concernLevels) as any,
						depression: getRandomElement(concernLevels) as any,
						suicidal_thoughts: getRandomElement(concernLevels) as any,
						study_skills: getRandomElement(concernLevels) as any,
						family_concerns: getRandomElement(concernLevels) as any,
						sexual_concerns: getRandomElement(concernLevels) as any,
						educational_concerns: getRandomElement(concernLevels) as any,
						anxiety: getRandomElement(concernLevels) as any,
						drug_use: getRandomElement(concernLevels) as any,
						physical_concerns: getRandomElement(concernLevels) as any,
						self_concept: getRandomElement(concernLevels) as any,
						decision_making_about_leaving_pup: getRandomElement(concernLevels) as any,
						financial_concerns: getRandomElement(concernLevels) as any,
						relationship_with_others: getRandomElement(concernLevels) as any,
						spirituality: getRandomElement(concernLevels) as any,
						weight_eating_issues: getRandomElement(concernLevels) as any,
						career: getRandomElement(concernLevels) as any
					}
				}
			});

			// Create Individual Inventory
			await prisma.individualInventory.create({
				data: {
					studentId: student.id,
					height: `${getRandomInt(150, 190)}`,
					weight: `${getRandomInt(45, 90)}`,
					coplexion: getRandomElement(["Light", "Medium", "Dark"]),
					student_signature: `${firstName.toUpperCase()} ${lastName.toUpperCase()}`,
					predictionGenerated: false,
					person_to_be_contacted_in_case_of_accident_or_illness: {
						firstName: getRandomElement(firstNames),
						lastName,
						middleName: getRandomElement(firstNames),
						relationship: "parent",
						address: {
							street: `${getRandomInt(1, 999)} Main St`,
							city: getRandomElement(cities),
							province: getRandomElement(provinces),
							zipCode: getRandomInt(1000, 9999),
							barangay: `Barangay ${getRandomInt(1, 50)}`,
							country: "Philippines"
						}
					},
					educational_background: {
						level: "high_school" as any,
						school_graduation: `${getRandomElement(cities)} National High School`,
						school_address: {
							street: "",
							province: getRandomElement(provinces),
							city: getRandomElement(cities),
							barangay: "",
							country: "Philippines"
						},
						status: getRandomElement(["public", "private"]) as any,
						dates_of_attendance: new Date(2020, 5, 1),
						honors_received: getRandomElement(["yes", "no"]) as any
					},
					nature_of_schooling: {
						continuous: getRandomInt(0, 1) === 1,
						interrupted: getRandomInt(0, 1) === 1,
						exaplain_why: null
					},
					home_and_family_background: {
						father: {
							firstName: getRandomElement(firstNames),
							lastName,
							middleName: getRandomElement(firstNames),
							age: getRandomInt(40, 65),
							status: "living" as any,
							educational_attainment: getRandomElement(["high_school", "bachelors_degree", "vocational"]) as any,
							occupation: getRandomElement(["Engineer", "Driver", "Seaman", "Teacher", "Business Owner"]),
							employer: {
								name: `${getRandomElement(["ABC", "XYZ", "Global", "National"])} Corporation`,
								address: {
									street: "",
									province: "",
									city: "",
									barangay: "",
									country: "Philippines"
								}
							}
						},
						mother: {
							firstName: getRandomElement(firstNames),
							lastName,
							middleName: getRandomElement(firstNames),
							age: getRandomInt(38, 60),
							status: "living" as any,
							educational_attainment: getRandomElement(["elementary", "high_school", "bachelors_degree"]) as any,
							occupation: getRandomElement(["Teacher", "Nurse", "House Wife", "Business Owner", "Government Employee"]),
							employer: {
								name: "",
								address: {
									street: "",
									province: "",
									city: "",
									barangay: "",
									country: "Philippines"
								}
							}
						},
						guardian: {
							firstName: "",
							lastName: "",
							middleName: "",
							age: 0,
							status: "living" as any,
							educational_attainment: "none" as any,
							occupation: "",
							employer: {
								name: "",
								address: {
									street: "",
									province: "",
									city: "",
									barangay: "",
									country: "Philippines"
								}
							}
						},
						parents_martial_relationship: "married_and_staying_together" as any,
						number_of_children_in_the_family_including_yourself: getRandomInt(1, 6),
						number_of_brothers: getRandomInt(0, 3),
						number_of_sisters: getRandomInt(0, 3),
						number_of_brothers_or_sisters_employed: getRandomInt(0, 2),
						ordinal_position: `${getRandomInt(1, 4)}${getRandomInt(1, 4) === 1 ? "st" : getRandomInt(1, 4) === 2 ? "nd" : getRandomInt(1, 4) === 3 ? "rd" : "th"} child`,
						is_your_brother_sister_who_is_gainfully_employed_providing_support_to_your: getRandomElement(["family", "your_studies", "his__or_her_own_family"]) as any,
						who_finances_your_schooling: getRandomElement(["parents", "scholarship", "self_supporting"]) as any,
						how_much_is_your_weekly_allowance: getRandomInt(500, 2000),
						parents_total_montly_income: {
							income: getRandomElement([
								"five_thousand_to_ten_thousand",
								"ten_thousand_to_fifteen_thousand",
								"fifteen_thousand_to_twenty_thousand",
								"twenty_thousand_to_twenty_five_thousand"
							]) as any,
							others: ""
						},
						do_you_have_quiet_place_to_study: getRandomElement(["yes", "no"]) as any,
						do_you_share_your_room_with_anyone: {
							status: getRandomElement(["yes", "no"]) as any,
							if_yes_with_whom: getRandomInt(0, 1) === 1 ? "siblings" : undefined
						},
						nature_of_residence_while_attending_school: getRandomElement(["family_home", "dorm", "rented_apartment", "bed_spacer"]) as any
					},
					health: {
						physical: {
							your_vision: getRandomInt(0, 10) > 8,
							your_hearing: getRandomInt(0, 10) > 8,
							your_speech: getRandomInt(0, 10) > 8,
							your_general_health: getRandomInt(0, 10) > 7,
							if_yes_please_specify: undefined
						},
						psychological: {
							consulted: getRandomElement(["psychiatrist", "psychologist", "councelor"]) as any,
							status: getRandomElement(["yes", "no"]) as any,
							when: undefined,
							for_what: undefined
						}
					},
					interest_and_hobbies: {
						academic: getRandomElement(["match_club", "debating_club", "science_club", "quizzers_club"]) as any,
						favorite_subject: getRandomElement(["Mathematics", "Science", "English", "Filipino", "Programming"]),
						favorite_least_subject: getRandomElement(["Mathematics", "Science", "History", "PE"]),
						what_are_your_hobbies: ["Reading", "Gaming", "Sports"],
						organizations_participated: getRandomElement(["athletics", "dramatics", "religous_organization", "chess_club"]) as any,
						occupational_position_organization: getRandomElement(["officer", "member"]) as any
					},
					test_results: undefined,
					significant_notes_councilor_only: undefined,
				}
			});

			// Create Anxiety Assessment
			const anxietyResponses = Array(7).fill(0).map(() => getRandomElement(frequencyOptions));
			const anxietyScore = anxietyResponses.reduce((sum, response) => sum + scoreMapping[response], 0);
			
			await prisma.anxietyAssessment.create({
				data: {
					userId: user.id,
					feeling_nervous_anxious_edge: anxietyResponses[0] as any,
					not_able_stop_control_worrying: anxietyResponses[1] as any,
					worrying_too_much_different_things: anxietyResponses[2] as any,
					trouble_relaxing: anxietyResponses[3] as any,
					restless_hard_sit_still: anxietyResponses[4] as any,
					easily_annoyed_irritable: anxietyResponses[5] as any,
					feeling_afraid_awful_happen: anxietyResponses[6] as any,
					totalScore: anxietyScore,
					severityLevel: calculateAnxietySeverity(anxietyScore) as any,
					assessmentDate: new Date(),
					difficulty_level: getRandomElement(difficultyOptions) as any,
					cooldownActive: false
				}
			});

			// Create Depression Assessment
			const depressionResponses = Array(9).fill(0).map(() => getRandomElement(frequencyOptions));
			const depressionScore = depressionResponses.reduce((sum, response) => sum + scoreMapping[response], 0);
			
			await prisma.depressionAssessment.create({
				data: {
					userId: user.id,
					little_interest_pleasure_doing_things: depressionResponses[0] as any,
					feeling_down_depressed_hopeless: depressionResponses[1] as any,
					trouble_falling_staying_asleep_too_much: depressionResponses[2] as any,
					feeling_tired_having_little_energy: depressionResponses[3] as any,
					poor_appetite_overeating: depressionResponses[4] as any,
					feeling_bad_about_yourself_failure: depressionResponses[5] as any,
					trouble_concentrating_things: depressionResponses[6] as any,
					moving_speaking_slowly_fidgety_restless: depressionResponses[7] as any,
					thoughts_better_off_dead_hurting_yourself: depressionResponses[8] as any,
					totalScore: depressionScore,
					severityLevel: calculateDepressionSeverity(depressionScore) as any,
					assessmentDate: new Date(),
					difficulty_level: getRandomElement(difficultyOptions) as any,
					cooldownActive: false
				}
			});

			// Create Stress Assessment
			const stressResponses = Array(10).fill(0).map(() => getRandomElement(stressOptions));
			const stressScore = stressResponses.reduce((sum, response) => sum + scoreMapping[response], 0);
			
			await prisma.stressAssessment.create({
				data: {
					userId: user.id,
					upset_because_something_unexpected: stressResponses[0] as any,
					unable_control_important_things: stressResponses[1] as any,
					feeling_nervous_and_stressed: stressResponses[2] as any,
					confident_handle_personal_problems: stressResponses[3] as any,
					feeling_things_going_your_way: stressResponses[4] as any,
					unable_cope_with_all_things: stressResponses[5] as any,
					able_control_irritations: stressResponses[6] as any,
					feeling_on_top_of_things: stressResponses[7] as any,
					angered_things_outside_control: stressResponses[8] as any,
					difficulties_piling_up_cant_overcome: stressResponses[9] as any,
					totalScore: stressScore,
					severityLevel: calculateStressSeverity(stressScore) as any,
					assessmentDate: new Date(),
					cooldownActive: false
				}
			});

			// Create Suicide Assessment (only for some students - about 20%)
			if (getRandomInt(1, 5) === 1) {
				const hasHighRisk = getRandomInt(1, 10) > 7;
				
				await prisma.suicideAssessment.create({
					data: {
						userId: user.id,
						wished_dead_or_sleep_not_wake_up: hasHighRisk ? "yes" : getRandomElement(["yes", "no"]) as any,
						actually_had_thoughts_killing_self: hasHighRisk ? "yes" : getRandomElement(["yes", "no"]) as any,
						thinking_about_how_might_do_this: hasHighRisk ? "yes" : getRandomElement(["yes", "no"]) as any,
						had_thoughts_and_some_intention: hasHighRisk ? "yes" : "no" as any,
						started_worked_out_details_how_kill: hasHighRisk ? "yes" : "no" as any,
						done_anything_started_prepared_end_life: "no" as any,
						behavior_timeframe: getRandomElement(["past_three_months", "lifetime_but_not_recent", "never"]) as any,
						riskLevel: hasHighRisk ? "high" : getRandomElement(["low", "moderate"]) as any,
						requires_immediate_intervention: hasHighRisk,
						assessmentDate: new Date()
					}
				});
			}

			console.log(`✓ Successfully created student ${i}/50`);
		} catch (error) {
			console.error(`✗ Error creating student ${i}:`, error);
		}
	}

	console.log("\nSeed completed successfully! 50 students created with all related data.");
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
