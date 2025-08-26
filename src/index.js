export default {
	async fetch(request, env) {
		console.log("Worker received request with method:", request.method);
		try {
			const update = await request.json();
			const message = update?.message?.text;
			const chatId =
				update?.message?.chat?.id ?? update?.callback_query?.message?.chat?.id;

			const callbackQuery = update.callback_query;
			const callbackId = callbackQuery?.id;
			const callbackData = callbackQuery?.data
				? JSON.parse(callbackQuery.data)
				: null;

			const target_lang = await env.LANG_STORAGE.get(chatId.toString()) || "UK";

			if (callbackId) {
				if (!chatId) {
					return new Response("No chatId for callback", { status: 400 });
				}
				if (callbackData.action === "set_language") {
					await env.LANG_STORAGE.put(chatId.toString(), callbackData.language);

					await fetch(
						`https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`,
						{
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								callback_query_id: callbackId,
								text: `Selected language: ${callbackData.language}`,
								show_alert: false,
							}),
						}
					);

					return new Response("OK");
				}

				if (callbackData.action === "save_translation") {
					const key = chatId.toString();

					const word = await env.TEMP_STORAGE.get(key);
					if (!word) {
						return new Response("No word found", { status: 400 });
					}

					const stored = await env.DICTIONARY_STORAGE.get(key);
					const dictionary = stored ? JSON.parse(stored) : [];

					if (!dictionary.includes(word)) {
						dictionary.push(word);
						await env.DICTIONARY_STORAGE.put(key, JSON.stringify(dictionary));
					}

					await fetch(
						`https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`,
						{
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								callback_query_id: callbackId,
								text: `Saved`,
								show_alert: false,
							}),
						}
					);

					return new Response("OK");
				}
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
									.filter((item) => item.language !== "RU")
									.map((item) => [
										{
											text: item.name,
											callback_data: JSON.stringify({
												action: "set_language",
												language: item.language,
											}),
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


			await env.TEMP_STORAGE.put(
				chatId.toString(),
				message + '-' + translated.translations[0].text
			);

			await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					chat_id: chatId,
					text: translated.translations[0].text,
					reply_markup: {
						inline_keyboard: [
							[
								{
									text: "Save",
									callback_data: JSON.stringify({
										action: "save_translation",
									}),
								},
							],
						],
					},
				}),
			});

			return new Response("OK");
		} catch (err) {
			return new Response(`Error: ${err.message}`, { status: 500 });
		}
	},
};