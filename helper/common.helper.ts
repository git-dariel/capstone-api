export const parseYYYYMMDDToDate = (dateStr: string): Date => {
	if (dateStr.length === 8) {
		// If format is YYYYMMDD
		return new Date(`${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`);
	}
	return new Date(dateStr);
};

export const formatToYYYYMMDD = (date: Date | string | undefined): string => {
	if (!date) return "";
	if (date instanceof Date) {
		return date.toISOString().split("T")[0].replace(/-/g, "");
	}
	return date.replace(/-/g, "");
};

export const formatPhoneNumber = (phone: string | undefined): string => {
	if (!phone) return "";
	const numbers = phone.replace(/\D/g, "");

	if (numbers.startsWith("0")) {
		return `63${numbers.slice(1)}`;
	}
	if (numbers.startsWith("63")) {
		return numbers;
	}
	if (numbers.length === 10) {
		return `63${numbers}`;
	}

	return numbers;
};
