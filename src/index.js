import { sendMessageRequest, answerCallbackQueryRequest, getLanguagesList, getTranslation } from "./api";

export default {
	async fetch(request, env) {
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

			// Handling callbacks

			if (callbackId) {
				if (!chatId) {
					return new Response("No chatId for callback", { status: 400 });
				}
				if (callbackData.action === "set_language") {
					await env.LANG_STORAGE.put(chatId.toString(), callbackData.language);

					const text = `Selected language: ${callbackData.language}`;
					await answerCallbackQueryRequest(callbackId, text, env.BOT_TOKEN);

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

					const text = "Saved";
					await answerCallbackQueryRequest(callbackId, text, env.BOT_TOKEN);

					return new Response("OK");
				}
			}

			if (!message || !chatId) {
				return new Response("No message or chatId", { status: 400 });
			}

			// Selecting translated language
			if (message === "/language") {
				const languagelist = await getLanguagesList(env.DEEPL_API_KEY)
					.then(
						(res) => res.json()
				);
				
				const bodyData = JSON.stringify({
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
				});

				await sendMessageRequest(bodyData, env.BOT_TOKEN);

				return new Response("OK");
			}

			// Displaying disctionary

			if (message === "/dictionary") {
				const stored = await env.DICTIONARY_STORAGE.get(chatId.toString());
				const dictionary = stored ? JSON.parse(stored) : [];

				const text = dictionary.length > 0
					? `Your saved translations:\n${dictionary.join("\n")}`
					: "No saved translations found.";
				
				const bodyData = JSON.stringify({
					chat_id: chatId,
					text,
				});

				await sendMessageRequest(bodyData, env.BOT_TOKEN);

				return new Response("OK");
			}

			// Translating

			const translated = await getTranslation(env.DEEPL_API_KEY, target_lang, message).then((res) => res.json());

			if (!translated.translations || translated.translations.length === 0) {
				return new Response("Translation failed", { status: 500 });
			}

			await env.TEMP_STORAGE.put(
				chatId.toString(),
				message + ' - ' + translated.translations[0].text
			);

			const bodyData = JSON.stringify({
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
			})

			await sendMessageRequest(bodyData, env.BOT_TOKEN);

			return new Response("OK");
		} catch (err) {
			return new Response(`Error: ${err.message}`, { status: 500 });
		}
	},
};