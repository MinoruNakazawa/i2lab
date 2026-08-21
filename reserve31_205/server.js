const express = require("express");
const path = require("path");
const fsSync = require("fs");
const fs = require("fs/promises");
const crypto = require("crypto");
const {
  ALLOWED_ROOMS,
  byStartAsc,
  hashDeletePin,
  hasOverlap,
  toApiItem,
  validateDeletePin,
  validateInput,
} = require("./api/_lib/common");

const app = express();

function loadEnvFile(fileName) {
  const filePath = path.join(__dirname, fileName);
  if (!fsSync.existsSync(filePath)) {
    return;
  }

  const lines = fsSync.readFileSync(filePath, "utf-8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = path.join(__dirname, "data", "reservations.json");

app.use(express.json());

async function ensureDbFile() {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, "[]\n", "utf-8");
  }
}

async function loadReservations() {
  await ensureDbFile();
  const raw = await fs.readFile(DB_PATH, "utf-8");

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter((item) => ALLOWED_ROOMS.includes(item.room));
}

async function saveReservations(items) {
  const body = `${JSON.stringify(items, null, 2)}\n`;
  await fs.writeFile(DB_PATH, body, "utf-8");
}

function getRequestBody(req) {
  return {
    room: typeof req.body.room === "string" ? req.body.room.trim() : "",
    startAt: typeof req.body.startAt === "string" ? req.body.startAt.trim() : "",
    endAt: typeof req.body.endAt === "string" ? req.body.endAt.trim() : "",
    purpose: typeof req.body.purpose === "string" ? req.body.purpose.trim() : "",
    booker: typeof req.body.booker === "string" ? req.body.booker.trim() : "",
    deletePin: typeof req.body.deletePin === "string" ? req.body.deletePin.trim() : "",
  };
}

app.get("/api/health", async (_req, res) => {
  res.json({ ok: true, storage: "local-json" });
});

app.get("/api/reservations", async (_req, res) => {
  try {
    const items = await loadReservations();
    res.json([...items].sort(byStartAsc).map(toApiItem));
  } catch (error) {
    res.status(500).json({ message: "予約データの読み込みに失敗しました。" });
  }
});

app.post("/api/reservations", async (req, res) => {
  try {
    const { room, startAt, endAt, purpose, booker, deletePin } = getRequestBody(req);

    const validationError = validateInput(room, startAt, endAt, purpose, booker);
    if (validationError) {
      res.status(400).json({ message: validationError });
      return;
    }

    const pinValidationError = validateDeletePin(deletePin);
    if (pinValidationError) {
      res.status(400).json({ message: pinValidationError });
      return;
    }

    const items = await loadReservations();
    const entry = {
      id: crypto.randomUUID(),
      room,
      startAt,
      endAt,
      purpose,
      booker,
      deletePinHash: hashDeletePin(deletePin),
      createdAt: new Date().toISOString(),
    };

    if (hasOverlap(items, entry)) {
      res
        .status(409)
        .json({ message: "選択した会議場所の同じ時間帯にすでに予約があります。日時を変更してください。" });
      return;
    }

    items.push(entry);
    await saveReservations(items);
    res.status(201).json(toApiItem(entry));
  } catch (error) {
    res.status(500).json({ message: "予約登録に失敗しました。" });
  }
});

app.put("/api/reservations/:id", async (req, res) => {
  try {
    const { room, startAt, endAt, purpose, booker } = getRequestBody(req);
    const validationError = validateInput(room, startAt, endAt, purpose, booker);
    if (validationError) {
      res.status(400).json({ message: validationError });
      return;
    }

    const items = await loadReservations();
    const target = items.find((item) => item.id === req.params.id);
    if (!target) {
      res.status(404).json({ message: "対象の予約が見つかりません。" });
      return;
    }

    const submittedPin = req.get("x-delete-pin") || "";
    const adminPin = process.env.DELETE_PIN || "";
    const pinMatchesReservation = target.deletePinHash && target.deletePinHash === hashDeletePin(submittedPin);
    const pinMatchesAdmin = adminPin && submittedPin === adminPin;

    if (!pinMatchesReservation && !pinMatchesAdmin) {
      res.status(401).json({ message: "予約PINが正しくありません。" });
      return;
    }

    const candidate = { id: req.params.id, room, startAt, endAt, purpose, booker };
    const otherItems = items.filter((item) => item.id !== req.params.id);
    if (hasOverlap(otherItems, candidate)) {
      res
        .status(409)
        .json({ message: "選択した会議場所の同じ時間帯にすでに予約があります。日時を変更してください。" });
      return;
    }

    const nextItems = items.map((item) =>
      item.id === req.params.id
        ? {
            ...item,
            room,
            startAt,
            endAt,
            purpose,
            booker,
          }
        : item,
    );
    const updated = nextItems.find((item) => item.id === req.params.id);

    await saveReservations(nextItems);
    res.status(200).json(toApiItem(updated));
  } catch (error) {
    res.status(500).json({ message: "予約変更に失敗しました。" });
  }
});

app.delete("/api/reservations/:id", async (req, res) => {
  try {
    const items = await loadReservations();
    const target = items.find((item) => item.id === req.params.id);
    if (!target) {
      res.status(404).json({ message: "対象の予約が見つかりません。" });
      return;
    }

    const submittedPin = req.get("x-delete-pin") || "";
    const adminPin = process.env.DELETE_PIN || "";
    const pinMatchesReservation = target.deletePinHash && target.deletePinHash === hashDeletePin(submittedPin);
    const pinMatchesAdmin = adminPin && submittedPin === adminPin;

    if (!pinMatchesReservation && !pinMatchesAdmin) {
      res.status(401).json({ message: "予約PINが正しくありません。" });
      return;
    }

    const nextItems = items.filter((item) => item.id !== req.params.id);

    await saveReservations(nextItems);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: "予約削除に失敗しました。" });
  }
});

app.use(express.static(__dirname));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Reserve app server running on http://localhost:${PORT}`);
});
