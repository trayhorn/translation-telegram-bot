export default {
	async fetch(request, env) {
		console.log("Worker received request with method:", request.method);

		try {
			const update = await request.json();
			const message = update?.message?.text;
			const chatId = update?.message?.chat?.id;

			if (!message || !chatId) {
				return new Response("No message or chatId", { status: 400 });
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
						target_lang: "UK",
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