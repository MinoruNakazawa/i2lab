const ALLOWED_ROOMS = ["31-205", "31-202"];
const crypto = require("crypto");

function parseDateTimeValue(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  const localMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );

  if (!localMatch) {
    return null;
  }

  const year = Number(localMatch[1]);
  const month = Number(localMatch[2]);
  const day = Number(localMatch[3]);
  const hour = Number(localMatch[4]);
  const minute = Number(localMatch[5]);
  const second = localMatch[6] ? Number(localMatch[6]) : 0;

  const date = new Date(year, month - 1, day, hour, minute, second, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return null;
  }

  return date;
}

function toTimestamp(value) {
  const date = parseDateTimeValue(value);
  return date ? date.getTime() : Number.NaN;
}

function validateInput(room, startAt, endAt, purpose, booker) {
  if (!room || !startAt || !endAt || !purpose || !booker) {
    return "すべての項目を入力してください。";
  }

  if (!ALLOWED_ROOMS.includes(room)) {
    return "会議場所の値が正しくありません。";
  }

  const start = toTimestamp(startAt);
  const end = toTimestamp(endAt);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return "日時の形式が正しくありません。";
  }

  if (start >= end) {
    return "終了日時は開始日時より後に設定してください。";
  }

  return null;
}

function validateDeletePin(deletePin) {
  if (typeof deletePin !== "string" || deletePin.trim().length < 4) {
    return "予約PINは4文字以上で入力してください。";
  }

  return null;
}

function hashDeletePin(deletePin) {
  const pepper = process.env.DELETE_PIN_PEPPER || process.env.ORIGIN_VERIFY_SECRET || "local-delete-pin-pepper";
  return crypto.createHash("sha256").update(`${pepper}:${deletePin}`).digest("hex");
}

function hasOverlap(items, candidate) {
  const start = toTimestamp(candidate.startAt);
  const end = toTimestamp(candidate.endAt);

  return items.some((item) => {
    if (item.room !== candidate.room) {
      return false;
    }

    const itemStart = toTimestamp(item.startAt);
    const itemEnd = toTimestamp(item.endAt);
    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      Number.isNaN(itemStart) ||
      Number.isNaN(itemEnd)
    ) {
      return false;
    }

    return start < itemEnd && itemStart < end;
  });
}

function toApiItem(row) {
  return {
    id: row.id,
    room: row.room,
    startAt: row.startAt,
    endAt: row.endAt,
    purpose: row.purpose,
    booker: row.booker,
  };
}

function normalizeItem(item) {
  return {
    id: typeof item.id === "string" ? item.id : "",
    room: ALLOWED_ROOMS.includes(item.room) ? item.room : "",
    startAt: typeof item.startAt === "string" ? item.startAt : "",
    endAt: typeof item.endAt === "string" ? item.endAt : "",
    purpose: typeof item.purpose === "string" ? item.purpose : "",
    booker: typeof item.booker === "string" ? item.booker : "",
    deletePinHash: typeof item.deletePinHash === "string" ? item.deletePinHash : "",
    createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
  };
}

function byStartAsc(a, b) {
  return toTimestamp(a.startAt) - toTimestamp(b.startAt);
}

module.exports = {
  ALLOWED_ROOMS,
  byStartAsc,
  hasOverlap,
  hashDeletePin,
  normalizeItem,
  toApiItem,
  validateDeletePin,
  validateInput,
};
