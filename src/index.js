import { createWorkersAI } from 'workers-ai-provider';

const TEXT_MODEL = '@cf/meta/llama-2-7b-chat-int8';
const IMAGE_MODEL = '@cf/stabilityai/stable-diffusion-xl-base-1.0';

export default {
  async fetch(request, env, ctx) {
    const workersai = createWorkersAI({ binding: env.AI });
    const data = await request.json();

    if (!data.message) {
      return new Response('OK', { status: 200 });
    }

    const chatId = data.message.chat.id;
    const messageText = data.message.text || '';

    if (messageText.startsWith('/image ')) {
      // Handle image generation
      const prompt = messageText.slice(7).trim();
      const image = await generateImage(workersai, prompt);
      await sendTelegramPhoto(chatId, image, env);
    } else {
      // Handle text generation
      const response = await generateText(workersai, messageText);
      await sendTelegramMessage(chatId, response, env);
    }

    return new Response('OK', { status: 200 });
  },
};

async function generateText(workersai, prompt) {
  const result = await workersai(TEXT_MODEL).generateText({
    prompt: `User: ${prompt}\nAssistant: `,
    max_tokens: 150,
  });
  return result.text;
}

async function generateImage(workersai, prompt) {
  const result = await workersai(IMAGE_MODEL).generateImage({
    prompt: prompt,
    num_steps: 20,
    width: 512,
    height: 512,
  });
  return result.image;
}

async function sendTelegramMessage(chatId, text, env) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text }),
  });

  if (!response.ok) {
    console.error('Failed to send Telegram message:', await response.text());
  }
}

async function sendTelegramPhoto(chatId, imageBuffer, env) {
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('photo', new Blob([imageBuffer], { type: 'image/png' }), 'image.png');

  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendPhoto`;
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    console.error('Failed to send Telegram photo:', await response.text());
  }
}
