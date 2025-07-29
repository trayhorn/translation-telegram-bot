export default {
	async fetch(request, env) {
		console.log("Worker received request with method:", request.method);
		try {
			const update = await request.json();
			const message = update?.message?.text;
			const chatId =
				update?.message?.chat?.id ?? update?.callback_query?.message?.chat?.id;


			const callbackQuery = update.callback_query;
			const data = callbackQuery?.data;
			const callbackId = callbackQuery?.id;

			const target_lang = await env.LANG_STORAGE.get(chatId.toString()) || "UK";

			if (callbackId) {
				if (!chatId) {
					return new Response("No chatId for callback", { status: 400 });
				}
				await env.LANG_STORAGE.put(chatId.toString(), data);

				await fetch(
					`https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							callback_query_id: callbackId,
							text: `Selected language: ${data}`,
							show_alert: false,
						}),
					}
				);

				return new Response("OK");
			}


			if (!message || !chatId) {
				return new Response("No message or chatId", { status: 400 });
			}

			// Selecting translated language
			if (message === "/language") {
				const languagelist = await fetch(
					"https://api-free.deepl.com/v2/languages",
					{
						headers: {
							Authorization: `DeepL-Auth-Key ${env.DEEPL_API_KEY}`,
						},
					}
				).then((res) => res.json());


				await fetch(
					`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							chat_id: chatId,
							text: "List of supported languages:",
							reply_markup: {
								inline_keyboard: languagelist
									.filter(item => item.language !== "RU")
									.map((item) => [
									{
										text: item.name,
										callback_data: item.language,
									},
								]),
							},
						}),
					}
				);

				return new Response("OK");
			}

			const translated = await fetch(
				"https://api-free.deepl.com/v2/translate",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
						Authorization: `DeepL-Auth-Key ${env.DEEPL_API_KEY}`,
					},
					body: new URLSearchParams({
						text: message,
						target_lang,
					}),
				}
			).then((res) => res.json());

			if (!translated.translations || translated.translations.length === 0) {
				return new Response("Translation failed", { status: 500 });
			}

			await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					chat_id: chatId,
					text: translated.translations[0].text,
				}),
			});

			return new Response("OK");
		} catch (err) {
			return new Response(`Error: ${err.message}`, { status: 500 });
		}
	},
};