import multer from "multer";

// Configure multer for file uploads
const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 10 * 1024 * 1024, // Increased to 10MB limit per file
		files: 10,
		fieldSize: 2 * 1024 * 1024, // 2MB field size limit
		headerPairs: 2000,
	},
	fileFilter: (req, file, cb) => {
		// Allow common document and image types
		const allowedTypes = [
			"image/jpeg",
			"image/png",
			"image/gif",
			"image/webp",
			"application/pdf",
			"application/msword",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"application/vnd.ms-excel",
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"text/plain",
			"text/csv",
		];

		if (allowedTypes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error(`File type ${file.mimetype} is not allowed`));
		}
	},
});

const multerHelper = {
	uploadFiles: upload.array("files", 10),

	uploadSingle: upload.single("file"),

	uploadFields: upload.fields([
		{ name: "photos", maxCount: 10 },
		{ name: "documents", maxCount: 10 },
	]),

	upload,
};

export default multerHelper;
