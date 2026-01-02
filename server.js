const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const DATA_FILE = path.join(DATA_DIR, "vision-board.txt"); // JSON stored in .txt

fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(express.json({ limit: "2mb" }));
app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOAD_DIR));

function safeExt(originalName) {
  const ext = path.extname(originalName || "").toLowerCase();
  const allowed = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
  return allowed.has(ext) ? ext : ".jpg";
}

function genMoodFilename(originalName) {
  const ext = safeExt(originalName);
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14); // YYYYMMDDHHMMSS
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `mood_${ts}_${rand}${ext}`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, genMoodFilename(file.originalname)),
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 }, // 12MB each
});

function readBoard() {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const raw = fs.readFileSync(DATA_FILE, "utf-8").trim();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeBoard(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// Default template (if txt not exists)
function defaultBoard() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    // Only content fields here (title is fixed in HTML)
    content: {
      subtitle: "Click the text to edit. Upload images in Mood & Aesthetic.",
      intentionsTitle: "Intentions",
      intentionsTag: "Focus",
      intentionsItems: [
        "Choose clarity over chaos.",
        "Build momentum with small daily wins.",
        "Be present with people I love.",
        "Create work I’m proud to share."
      ],
      quoteMain: "“Warm heart, clear mind, steady steps.”",
      quoteSub: "My energy for 2026",
      habitsTitle: "Habits",
      habitsTag: "Daily",
      habitsItems: [
        "30 minutes deep work before scrolling.",
        "Move my body (walk, swim, stretch).",
        "One meaningful check-in with someone.",
        "Write 3 lines of gratitude."
      ],
      moodTitle: "Mood & Aesthetic",
      moodTag: "Playful + Warm",
      moodHint: "No crop: images keep their full height. This panel scrolls.",
      goalsTitle: "Goals",
      goalsTag: "Milestones",
      goalsItems: [
        "One project shipped that I truly care about.",
        "Stronger health routine (sleep, movement, meals).",
        "More time outdoors + mini trips.",
        "Save and invest consistently."
      ],
      peopleTitle: "People & Places",
      peopleTag: "Connection",
      peopleItems: [
        "Make space for friendships that feel easy.",
        "Plan 2–3 meaningful catch-ups each month.",
        "Create a home vibe that feels calm and warm."
      ],
      footerTip: "Tip: click text to edit. Mood images show fully (no cropping)."
    },
    moodImages: [] // filenames in /uploads
  };
}

// GET: load board
app.get("/api/board", (req, res) => {
  const data = readBoard();
  return res.json(data || defaultBoard());
});

// POST: save board (content + mood filenames)
app.post("/api/board", (req, res) => {
  const body = req.body || {};
  if (typeof body !== "object") return res.status(400).json({ ok: false, error: "Invalid payload" });

  const current = readBoard() || defaultBoard();
  const next = {
    version: 1,
    updatedAt: new Date().toISOString(),
    content: body.content && typeof body.content === "object" ? body.content : current.content,
    moodImages: Array.isArray(body.moodImages) ? body.moodImages : current.moodImages
  };

  writeBoard(next);
  res.json({ ok: true });
});

// POST: upload mood images (renamed, saved to /uploads)
app.post("/api/upload-mood", upload.array("images", 30), (req, res) => {
  const files = req.files || [];
  const saved = files.map((f) => ({
    filename: f.filename,
    url: `/uploads/${f.filename}`
  }));
  res.json({ ok: true, files: saved });
});

// OPTIONAL: delete image and remove from txt
app.post("/api/delete-mood", (req, res) => {
  const { filename } = req.body || {};
  if (!filename || typeof filename !== "string") {
    return res.status(400).json({ ok: false, error: "filename required" });
  }

  const full = path.join(UPLOAD_DIR, filename);
  if (fs.existsSync(full)) fs.unlinkSync(full);

  const board = readBoard();
  if (board && Array.isArray(board.moodImages)) {
    board.moodImages = board.moodImages.filter((x) => x !== filename);
    board.updatedAt = new Date().toISOString();
    writeBoard(board);
  }

  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
