// frontend/server.js — Node adapter so the Cloudflare-style SSR bundle runs on AWS
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use("/assets", express.static(path.join(__dirname, "dist/client/assets")));

app.use(async (req, res) => {
  try {
    const { default: handler } = await import("./dist/server/server.js");
    const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : req,
      duplex: "half",
    });
    const response = await handler.fetch(request, {}, {});
    res.status(response.status);
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error("SSR handler error:", err);
    res.status(500).send("Server error");
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));