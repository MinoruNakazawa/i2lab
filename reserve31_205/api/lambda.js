const crypto = require("crypto");
const {
  createReservation,
  deleteReservation,
  getReservation,
  listReservations,
  listReservationsByRoom,
  updateReservation,
} = require("./_lib/dynamodb-store");
const {
  hashDeletePin,
  hasOverlap,
  toApiItem,
  validateDeletePin,
  validateInput,
} = require("./_lib/common");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "https://example.invalid",
  "Access-Control-Allow-Headers": "content-type,x-delete-pin",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  };
}

function empty(statusCode) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: "",
  };
}

function getMethod(event) {
  return event.requestContext && event.requestContext.http
    ? event.requestContext.http.method
    : event.httpMethod;
}

function getPath(event) {
  if (event.rawPath) {
    return event.rawPath;
  }

  return event.path || "/";
}

function getReservationId(path, event) {
  if (event.pathParameters && typeof event.pathParameters.id === "string") {
    return event.pathParameters.id;
  }

  const match = path.match(/^\/api\/reservations\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : "";
}

function parseBody(event) {
  if (!event.body) {
    return {};
  }

  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf-8")
    : event.body;

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getHeader(event, name) {
  const headers = event.headers || {};
  const expected = name.toLowerCase();
  const key = Object.keys(headers).find((headerName) => headerName.toLowerCase() === expected);
  return key ? headers[key] : "";
}

function canDelete(event) {
  return Boolean(getHeader(event, "x-delete-pin"));
}

function isTrustedOrigin(event) {
  const expectedSecret = process.env.ORIGIN_VERIFY_SECRET || "";
  if (!expectedSecret) {
    return true;
  }

  return getHeader(event, "x-origin-verify") === expectedSecret;
}

function getReservationPayload(event) {
  const body = parseBody(event);
  return {
    room: typeof body.room === "string" ? body.room.trim() : "",
    startAt: typeof body.startAt === "string" ? body.startAt.trim() : "",
    endAt: typeof body.endAt === "string" ? body.endAt.trim() : "",
    purpose: typeof body.purpose === "string" ? body.purpose.trim() : "",
    booker: typeof body.booker === "string" ? body.booker.trim() : "",
    deletePin: typeof body.deletePin === "string" ? body.deletePin.trim() : "",
  };
}

async function handleGetReservations() {
  const items = await listReservations();
  return json(200, items.map(toApiItem));
}

async function handlePostReservations(event) {
  const payload = getReservationPayload(event);
  const validationError = validateInput(
    payload.room,
    payload.startAt,
    payload.endAt,
    payload.purpose,
    payload.booker,
  );

  if (validationError) {
    return json(400, { message: validationError });
  }

  const pinValidationError = validateDeletePin(payload.deletePin);
  if (pinValidationError) {
    return json(400, { message: pinValidationError });
  }

  const roomItems = await listReservationsByRoom(payload.room);
  if (hasOverlap(roomItems, payload)) {
    return json(409, {
      message: "選択した会議場所の同じ時間帯にすでに予約があります。日時を変更してください。",
    });
  }

  const entry = {
    id: crypto.randomUUID(),
    room: payload.room,
    startAt: payload.startAt,
    endAt: payload.endAt,
    purpose: payload.purpose,
    booker: payload.booker,
    deletePinHash: hashDeletePin(payload.deletePin),
    createdAt: new Date().toISOString(),
  };

  await createReservation(entry);
  return json(201, toApiItem(entry));
}

async function getAuthorizedReservation(path, event) {
  if (!canDelete(event)) {
    return { response: json(401, { message: "予約PINを入力してください。" }) };
  }

  const id = getReservationId(path, event);
  if (!id) {
    return { response: json(400, { message: "ID が不正です。" }) };
  }

  const reservation = await getReservation(id);
  if (!reservation) {
    return { response: json(404, { message: "対象の予約が見つかりません。" }) };
  }

  const submittedPin = getHeader(event, "x-delete-pin");
  const adminPin = process.env.DELETE_PIN || "";
  const pinMatchesReservation =
    reservation.deletePinHash && reservation.deletePinHash === hashDeletePin(submittedPin);
  const pinMatchesAdmin = adminPin && submittedPin === adminPin;

  if (!pinMatchesReservation && !pinMatchesAdmin) {
    return { response: json(401, { message: "予約PINが正しくありません。" }) };
  }

  return { id, reservation };
}

async function handlePutReservation(path, event) {
  const auth = await getAuthorizedReservation(path, event);
  if (auth.response) {
    return auth.response;
  }

  const payload = getReservationPayload(event);
  const validationError = validateInput(
    payload.room,
    payload.startAt,
    payload.endAt,
    payload.purpose,
    payload.booker,
  );

  if (validationError) {
    return json(400, { message: validationError });
  }

  const roomItems = await listReservationsByRoom(payload.room);
  const otherRoomItems = roomItems.filter((item) => item.id !== auth.id);
  if (hasOverlap(otherRoomItems, payload)) {
    return json(409, {
      message: "選択した会議場所の同じ時間帯にすでに予約があります。日時を変更してください。",
    });
  }

  const updated = {
    ...auth.reservation,
    room: payload.room,
    startAt: payload.startAt,
    endAt: payload.endAt,
    purpose: payload.purpose,
    booker: payload.booker,
  };

  await updateReservation(updated);
  return json(200, toApiItem(updated));
}

async function handleDeleteReservation(path, event) {
  const auth = await getAuthorizedReservation(path, event);
  if (auth.response) {
    return auth.response;
  }

  const deleted = await deleteReservation(auth.id);
  if (!deleted) {
    return json(404, { message: "対象の予約が見つかりません。" });
  }

  return empty(204);
}

async function handler(event) {
  const method = getMethod(event);
  const path = getPath(event);

  try {
    if (!isTrustedOrigin(event)) {
      return json(403, { message: "Forbidden" });
    }

    if (method === "OPTIONS") {
      return empty(204);
    }

    if (method === "GET" && path === "/api/health") {
      return json(200, { ok: true, storage: "dynamodb" });
    }

    if (method === "GET" && path === "/api/reservations") {
      return handleGetReservations();
    }

    if (method === "POST" && path === "/api/reservations") {
      return handlePostReservations(event);
    }

    if (method === "PUT" && path.startsWith("/api/reservations/")) {
      return handlePutReservation(path, event);
    }

    if (method === "DELETE" && path.startsWith("/api/reservations/")) {
      return handleDeleteReservation(path, event);
    }

    return json(404, { message: "Not Found" });
  } catch (error) {
    console.error(error);
    return json(500, { message: "サーバー処理に失敗しました。" });
  }
}

module.exports = {
  handler,
};
