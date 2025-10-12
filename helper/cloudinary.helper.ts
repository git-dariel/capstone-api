import { cloudinary } from "../config/cloudinary";

const MAIN_FOLDER = "mental-health-assets";

const cloudinaryService = {
	uploadAttachment,
	deleteAttachment,
};

export default cloudinaryService;

async function uploadAttachment(file: Express.Multer.File, subfolder?: string): Promise<any> {
	const b64 = Buffer.from(file.buffer).toString("base64");
	const dataURI = `data:${file.mimetype};base64,${b64}`;

	// Construct the folder path
	const folderPath = subfolder ? `${MAIN_FOLDER}/${subfolder}` : MAIN_FOLDER;

	// Create a timeout promise
	const uploadPromise = cloudinary.uploader.upload(dataURI, {
		resource_type: "auto",
		folder: folderPath,
		use_filename: true,
		unique_filename: true,
		overwrite: true,
		timeout: 60000, // 60 seconds timeout
	});

	const timeoutPromise = new Promise((_, reject) => {
		setTimeout(() => reject(new Error("Upload timeout after 60 seconds")), 60000);
	});

	// Race between upload and timeout
	const result = (await Promise.race([uploadPromise, timeoutPromise])) as any;

	const uploadedImage = {
		url: result.secure_url,
		publicId: result.public_id,
		filename: file.originalname,
		filetype: file.mimetype,
		size: file.size,
	};

	return uploadedImage;
}

async function deleteAttachment(publicId: string, subfolder?: string): Promise<void> {
	try {
		const fullPublicId = publicId.includes(MAIN_FOLDER)
			? publicId
			: subfolder
				? `${MAIN_FOLDER}/${subfolder}/${publicId}`
				: `${MAIN_FOLDER}/${publicId}`;

		await cloudinary.uploader.destroy(fullPublicId);
	} catch (error) {
		throw new Error("Error deleting image from Cloudinary");
	}
}
