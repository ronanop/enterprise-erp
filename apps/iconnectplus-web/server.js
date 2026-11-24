import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, "dist");
const indexHtml = path.join(dist, "index.html");
const port = Number(process.env.PORT) || 3000;

if (!fs.existsSync(indexHtml)) {
  console.error(
    "Missing dist/index.html. Run `npm run build` before `npm start` (Hostinger build step).",
  );
  process.exit(1);
}

const app = express();

app.get("/health", (_req, res) => {
  res.status(200).type("text").send("ok");
});

app.use(express.static(dist, { index: false, maxAge: "1h" }));

// SPA fallback — avoid Express path-to-regexp "*" which can crash the process
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    next();
    return;
  }
  res.sendFile(indexHtml, (err) => {
    if (err) next(err);
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`iconnectplus-web listening on 0.0.0.0:${port} (node ${process.version})`);
});
