export type CallbackFunction = (error: Error | null, allowed?: boolean) => void;

const wildCardOrigin = (
	origin: string | undefined,
	callback: CallbackFunction,
	startsWith: string,
): void => {
	if (origin && origin.startsWith(startsWith)) {
		callback(null, true);
	} else {
		callback(new Error("Not allowed by CORS"));
	}
};

export default wildCardOrigin;
