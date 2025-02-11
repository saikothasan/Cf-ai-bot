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

    try {
      if (messageText === '/start') {
        await sendStartMessage(chatId, env);
      } else if (messageText.startsWith('/image ')) {
        const prompt = messageText.slice(7).trim();
        const image = await generateImage(workersai, prompt);
        await sendTelegramPhoto(chatId, image, env);
      } else {
        const response = await generateText(workersai, messageText);
        await sendTelegramMessage(chatId, response, env);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      await sendTelegramMessage(chatId, "I'm sorry, but I encountered an error processing your request. Please try again later.", env);
    }

    return new Response('OK', { status: 200 });
  },
};

async function generateText(workersai, prompt) {
  const result = await workersai(TEXT_MODEL).generateText({
    prompt: `User: ${prompt}\nAssistant: `,
    max_tokens: 350,
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

async function sendStartMessage(chatId, env) {
  const message = `
*Welcome to the AI Assistant Bot!* 🤖✨

Here are the available commands:

• Send any text message to get an AI-generated response.
• Use \`/image\` followed by a prompt to generate an image.

Examples:
• "Tell me about quantum computing"
• "/image A serene landscape with mountains and a lake"

Feel free to ask questions or request images. Enjoy! 🚀
  `;

  await sendTelegramMessage(chatId, message, env, true);
}

async function sendTelegramMessage(chatId, text, env, markdown = false) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: markdown ? 'MarkdownV2' : 'None',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send Telegram message: ${await response.text()}`);
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
    throw new Error(`Failed to send Telegram photo: ${await response.text()}`);
  }
}
