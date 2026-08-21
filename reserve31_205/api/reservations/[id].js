const {
  deleteReservation,
  getReservation,
  listReservationsByRoom,
  updateReservation,
} = require("../_lib/dynamodb-store");
const { hashDeletePin, hasOverlap, toApiItem, validateInput } = require("../_lib/common");

module.exports = async (req, res) => {
  if (!["DELETE", "PUT"].includes(req.method)) {
    res.setHeader("Allow", "DELETE, PUT");
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) {
    res.status(400).json({ message: "ID が不正です。" });
    return;
  }

  try {
    const reservation = await getReservation(id);
    if (!reservation) {
      res.status(404).json({ message: "対象の予約が見つかりません。" });
      return;
    }

    const submittedPin = req.headers["x-delete-pin"] || "";
    const adminPin = process.env.DELETE_PIN || "";
    const pinMatchesReservation =
      reservation.deletePinHash && reservation.deletePinHash === hashDeletePin(submittedPin);
    const pinMatchesAdmin = adminPin && submittedPin === adminPin;

    if (!pinMatchesReservation && !pinMatchesAdmin) {
      res.status(401).json({ message: "予約PINが正しくありません。" });
      return;
    }

    if (req.method === "PUT") {
      const room = typeof req.body.room === "string" ? req.body.room.trim() : "";
      const startAt = typeof req.body.startAt === "string" ? req.body.startAt.trim() : "";
      const endAt = typeof req.body.endAt === "string" ? req.body.endAt.trim() : "";
      const purpose = typeof req.body.purpose === "string" ? req.body.purpose.trim() : "";
      const booker = typeof req.body.booker === "string" ? req.body.booker.trim() : "";
      const validationError = validateInput(room, startAt, endAt, purpose, booker);
      if (validationError) {
        res.status(400).json({ message: validationError });
        return;
      }

      const roomItems = await listReservationsByRoom(room);
      const otherItems = roomItems.filter((item) => item.id !== id);
      if (hasOverlap(otherItems, { room, startAt, endAt })) {
        res.status(409).json({
          message: "選択した会議場所の同じ時間帯にすでに予約があります。日時を変更してください。",
        });
        return;
      }

      const updated = {
        ...reservation,
        room,
        startAt,
        endAt,
        purpose,
        booker,
      };
      await updateReservation(updated);
      res.status(200).json(toApiItem(updated));
      return;
    }

    const deleted = await deleteReservation(id);
    if (!deleted) {
      res.status(404).json({ message: "対象の予約が見つかりません。" });
      return;
    }

    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "予約削除に失敗しました。" });
  }
};
