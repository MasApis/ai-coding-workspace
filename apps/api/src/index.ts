import { createApp } from "./app.js";

const HOST = process.env["API_HOST"] ?? "127.0.0.1";
const PORT = Number(process.env["API_PORT"] ?? 3001);

const app = await createApp();
await app.listen({ host: HOST, port: PORT });
console.log(`api listening on http://${HOST}:${PORT}`);
