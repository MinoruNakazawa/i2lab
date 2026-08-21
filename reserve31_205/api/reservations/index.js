const {
  createReservation,
  listReservations,
  listReservationsByRoom,
} = require("../_lib/dynamodb-store");
const {
  hashDeletePin,
  hasOverlap,
  toApiItem,
  validateDeletePin,
  validateInput,
} = require("../_lib/common");
const crypto = require("crypto");

module.exports = async (req, res) => {
  if (req.method === "GET") {
    try {
      const items = await listReservations();
      res.status(200).json(items.map(toApiItem));
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "予約登録に失敗しました。" });
    }
    return;
  }

  if (req.method === "POST") {
    const room = typeof req.body.room === "string" ? req.body.room.trim() : "";
    const startAt = typeof req.body.startAt === "string" ? req.body.startAt.trim() : "";
    const endAt = typeof req.body.endAt === "string" ? req.body.endAt.trim() : "";
    const purpose = typeof req.body.purpose === "string" ? req.body.purpose.trim() : "";
    const booker = typeof req.body.booker === "string" ? req.body.booker.trim() : "";
    const deletePin = typeof req.body.deletePin === "string" ? req.body.deletePin.trim() : "";

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

    try {
      const roomItems = await listReservationsByRoom(room);
      if (hasOverlap(roomItems, { room, startAt, endAt })) {
        res.status(409).json({
          message: "選択した会議場所の同じ時間帯にすでに予約があります。日時を変更してください。",
        });
        return;
      }

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

      await createReservation(entry);
      res.status(201).json(toApiItem(entry));
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "予約データの取得に失敗しました。" });
    }
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ message: "Method Not Allowed" });
};
