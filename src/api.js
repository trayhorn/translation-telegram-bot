export const sendMessageRequest = (body, BOT_TOKEN) => {
	return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body,
	});
};


export const answerCallbackQueryRequest = (callbackId, text, BOT_TOKEN) => {
	return fetch(
		`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				callback_query_id: callbackId,
				text,
				show_alert: false,
			}),
		}
	);
};

export const getLanguagesList = (API_KEY) => {
	return fetch("https://api-free.deepl.com/v2/languages", {
		headers: {
			Authorization: `DeepL-Auth-Key ${API_KEY}`,
		},
	});
};

export const getTranslation = (API_KEY, target_lang, text) => {
	return fetch("https://api-free.deepl.com/v2/translate", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Authorization: `DeepL-Auth-Key ${API_KEY}`,
		},
		body: new URLSearchParams({
			text,
			target_lang,
		}),
	});
};
