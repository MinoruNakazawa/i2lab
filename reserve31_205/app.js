const API_BASE = window.RESERVATION_API_BASE || "/api/reservations";
const ALLOWED_ROOMS = ["31-205", "31-202"];
const IS_ENGLISH = document.documentElement.lang.toLowerCase().startsWith("en");
const WEEKDAY_LABELS = IS_ENGLISH
  ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  : ["日", "月", "火", "水", "木", "金", "土"];
const TEXT = IS_ENGLISH
  ? {
      fetchFailed: "Could not load reservation data.", createFailed: "Could not create the reservation.",
      deleteFailed: "Could not delete the reservation.", updateFailed: "Could not save the changes.",
      invalidData: "Reservation data has an invalid format.", invalidDate: "Invalid date and time",
      period: "Showing", noReservations: "There are no reservations in the next 7 days.",
      room: "Room", purpose: "Purpose", booker: "Booked by", editHint: "Double-click to edit",
      more: "more", pinPrompt: "Enter the reservation PIN.", open: "Open", close: "Close",
      allRequired: "Please complete all fields.", pinLength: "The reservation PIN must be at least 4 characters.",
      invalidRoom: "The room value is invalid.", invalidDateFormat: "The date and time format is invalid.",
      endAfterStart: "The end time must be after the start time.", invalidRepeat: "The repeat setting is invalid.",
      repeatUntil: "Enter a repeat end date.", repeatAfterStart: "The repeat end date must be on or after the start date.",
    }
  : {
      fetchFailed: "予約データの取得に失敗しました。", createFailed: "予約登録に失敗しました。",
      deleteFailed: "予約削除に失敗しました。", updateFailed: "予約変更に失敗しました。",
      invalidData: "予約データの形式が正しくありません。", invalidDate: "無効な日時",
      period: "表示期間", noReservations: "今日から7日間の予約はまだありません。",
      room: "会議場所", purpose: "用途", booker: "予約者", editHint: "ダブルクリックで編集",
      more: "ほか", pinPrompt: "予約PINを入力してください。", open: "開く", close: "閉じる",
      allRequired: "すべての項目を入力してください。", pinLength: "予約PINは4文字以上で入力してください。",
      invalidRoom: "会議場所の値が正しくありません。", invalidDateFormat: "日時の形式が正しくありません。",
      endAfterStart: "終了日時は開始日時より後に設定してください。", invalidRepeat: "繰り返し設定の値が正しくありません。",
      repeatUntil: "繰り返し終了日を入力してください。", repeatAfterStart: "繰り返し終了日は開始日以降に設定してください。",
    };

const form = document.getElementById("reservation-form");
const toggleFormButton = document.getElementById("toggle-form");
const roomInput = document.getElementById("room");
const startAtInput = document.getElementById("startAt");
const endAtInput = document.getElementById("endAt");
const repeatTypeInput = document.getElementById("repeatType");
const repeatUntilField = document.getElementById("repeat-until-field");
const repeatUntilInput = document.getElementById("repeatUntil");
const purposeInput = document.getElementById("purpose");
const bookerInput = document.getElementById("booker");
const deletePinInput = document.getElementById("deletePin");
const reservationList = document.getElementById("reservation-list");
const reservationListRange = document.getElementById("reservation-list-range");
const reservationTemplate = document.getElementById("reservation-item-template");
const calendarGrid = document.getElementById("calendar-grid");
const currentMonthLabel = document.getElementById("current-month");
const prevMonthButton = document.getElementById("prev-month");
const nextMonthButton = document.getElementById("next-month");
const viewButtons = Array.from(document.querySelectorAll("[data-view]"));
const editModal = document.getElementById("edit-modal");
const editForm = document.getElementById("edit-form");
const editIdInput = document.getElementById("editId");
const editRoomInput = document.getElementById("editRoom");
const editStartAtInput = document.getElementById("editStartAt");
const editEndAtInput = document.getElementById("editEndAt");
const editPurposeInput = document.getElementById("editPurpose");
const editBookerInput = document.getElementById("editBooker");
const editDeletePinInput = document.getElementById("editDeletePin");
const editCancelButton = document.getElementById("editCancel");
const editDeleteButton = document.getElementById("editDelete");
const submitButton = form.querySelector("button[type='submit']");

let reservations = [];
let displayDate = new Date();
let calendarView = "month";
let shouldAutoUpdateEndAt = true;
let isReservationFormOpen = false;

function parseDateTimeValue(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  const localMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );

  if (localMatch) {
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

  const fallback = new Date(trimmed);
  if (Number.isNaN(fallback.getTime())) {
    return null;
  }
  return fallback;
}

function toTimestamp(value) {
  const date = parseDateTimeValue(value);
  return date ? date.getTime() : Number.NaN;
}

function toDateTimeLocalValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultEndAtFor(startAt) {
  const start = parseDateTimeValue(startAt);
  if (!start) {
    return "";
  }

  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return toDateTimeLocalValue(end);
}

function defaultRepeatUntilFor(startAt) {
  const start = parseDateTimeValue(startAt);
  if (!start) {
    return "";
  }

  const until = addMonthsClamped(start, 3);
  return toDateInputValue(until);
}

function updateDefaultEndAt() {
  if (!shouldAutoUpdateEndAt) {
    return;
  }

  endAtInput.value = defaultEndAtFor(startAtInput.value);
}

async function parseApiError(response, fallbackMessage) {
  try {
    const body = await response.json();
    if (body && typeof body.message === "string" && body.message.trim()) {
      return IS_ENGLISH ? fallbackMessage : body.message;
    }
  } catch {
    // ignore parse failures and use fallback message
  }

  return fallbackMessage;
}

async function parseApiJson(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(fallbackMessage);
  }

  return response.json();
}

async function fetchReservations() {
  const response = await fetch(API_BASE);
  if (!response.ok) {
    throw new Error(await parseApiError(response, TEXT.fetchFailed));
  }

  const data = await parseApiJson(response, TEXT.fetchFailed);
  if (!Array.isArray(data)) {
    throw new Error(TEXT.invalidData);
  }

  reservations = data.filter((item) => ALLOWED_ROOMS.includes(item.room));
}

async function createReservation(entry) {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(entry),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, TEXT.createFailed));
  }

  return parseApiJson(response, TEXT.createFailed);
}

async function deleteReservation(id, deletePin) {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: "DELETE",
    headers: {
      "X-Delete-Pin": deletePin,
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, TEXT.deleteFailed));
  }
}

async function updateReservation(id, entry, deletePin) {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Delete-Pin": deletePin,
    },
    body: JSON.stringify(entry),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, TEXT.updateFailed));
  }

  return parseApiJson(response, TEXT.updateFailed);
}

function toDateTimeText(isoString) {
  const d = parseDateTimeValue(isoString);
  if (!d) {
    return TEXT.invalidDate;
  }
  return d.toLocaleString(IS_ENGLISH ? "en-US" : "ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function addMonthsClamped(date, months) {
  const nextDate = new Date(date);
  const originalDay = nextDate.getDate();
  nextDate.setDate(1);
  nextDate.setMonth(nextDate.getMonth() + months);
  const lastDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
  nextDate.setDate(Math.min(originalDay, lastDay));
  return nextDate;
}

function startOfWeek(date) {
  return addDays(date, -date.getDay());
}

function toDateLabel(date) {
  return IS_ENGLISH
    ? `${WEEKDAY_LABELS[date.getDay()]}, ${date.getMonth() + 1}/${date.getDate()}`
    : `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAY_LABELS[date.getDay()]})`;
}

function toRangeLabel(start, end) {
  if (start.getFullYear() === end.getFullYear()) {
    return IS_ENGLISH
      ? `${start.getFullYear()} ${toDateLabel(start)} – ${toDateLabel(end)}`
      : `${start.getFullYear()}年 ${toDateLabel(start)} - ${toDateLabel(end)}`;
  }

  return IS_ENGLISH
    ? `${start.getFullYear()} ${toDateLabel(start)} – ${end.getFullYear()} ${toDateLabel(end)}`
    : `${start.getFullYear()}年 ${toDateLabel(start)} - ${end.getFullYear()}年 ${toDateLabel(end)}`;
}

function byStartAsc(a, b) {
  return toTimestamp(a.startAt) - toTimestamp(b.startAt);
}

function roomClassName(room) {
  return `room-${room.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
}

function renderReservations() {
  reservationList.innerHTML = "";
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const listEnd = addDays(todayStart, 7);
  reservationListRange.textContent = `${TEXT.period}: ${toDateLabel(todayStart)} - ${toDateLabel(addDays(listEnd, -1))}`;
  const sorted = reservations
    .filter((item) => {
      const start = parseDateTimeValue(item.startAt);
      return start ? start >= todayStart && start < listEnd : false;
    })
    .sort(byStartAsc);

  if (sorted.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = TEXT.noReservations;
    empty.className = "reservation-item";
    reservationList.append(empty);
    return;
  }

  sorted.forEach((item) => {
    const fragment = reservationTemplate.content.cloneNode(true);
    const reservationItem = fragment.querySelector(".reservation-item");
    reservationItem.classList.add(roomClassName(item.room));
    reservationItem.addEventListener("dblclick", () => openEditModal(item));

    fragment.querySelector(".reservation-time").textContent =
      `${toDateTimeText(item.startAt)} - ${toDateTimeText(item.endAt)}`;
    fragment.querySelector(".reservation-room").textContent = `${TEXT.room}: ${item.room}`;
    fragment.querySelector(".reservation-purpose").textContent = `${TEXT.purpose}: ${item.purpose}`;
    fragment.querySelector(".reservation-booker").textContent = `${TEXT.booker}: ${item.booker}`;

    const deleteButton = fragment.querySelector(".delete-btn");
    deleteButton.addEventListener("click", async () => {
      const deletePin = window.prompt(TEXT.pinPrompt);
      if (deletePin === null) {
        return;
      }

      deleteButton.disabled = true;
      try {
        await deleteReservation(item.id, deletePin);
        reservations = reservations.filter((entry) => entry.id !== item.id);
        renderReservations();
        renderCalendar();
      } catch (error) {
        alert(error instanceof Error ? error.message : TEXT.deleteFailed);
        deleteButton.disabled = false;
      }
    });

    reservationList.append(fragment);
  });
}

function eventsForDate(date) {
  return reservations
    .filter((item) => {
      const start = parseDateTimeValue(item.startAt);
      return start ? sameDay(start, date) : false;
    })
    .sort(byStartAsc);
}

function renderCalendar() {
  calendarGrid.innerHTML = "";
  calendarGrid.className = `calendar-grid ${calendarView}-view`;

  const today = new Date();
  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();
  let firstCellDate;
  let cellCount;
  let visibleMonth = month;

  if (calendarView === "month") {
    currentMonthLabel.textContent = IS_ENGLISH
      ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, month, 1))
      : `${year}年 ${month + 1}月`;
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    firstCellDate = new Date(year, month, 1 - startWeekday);
    cellCount = 42;
  } else if (calendarView === "week") {
    firstCellDate = startOfWeek(displayDate);
    cellCount = 7;
    currentMonthLabel.textContent = toRangeLabel(firstCellDate, addDays(firstCellDate, 6));
  } else {
    firstCellDate = new Date(year, month, displayDate.getDate());
    cellCount = 1;
    currentMonthLabel.textContent = IS_ENGLISH
      ? new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(firstCellDate)
      : `${year}年 ${month + 1}月 ${displayDate.getDate()}日`;
  }

  for (let i = 0; i < cellCount; i += 1) {
    const cellDate = addDays(firstCellDate, i);

    const cell = document.createElement("article");
    cell.className = "calendar-cell";

    if (calendarView === "month" && cellDate.getMonth() !== visibleMonth) {
      cell.classList.add("other-month");
    }

    if (sameDay(cellDate, today)) {
      cell.classList.add("today");
    }

    const dateLabel = document.createElement("p");
    dateLabel.className = "date-label";
    dateLabel.textContent = toDateLabel(cellDate);

    const eventsContainer = document.createElement("div");
    eventsContainer.className = "day-events";

    const dayEvents = eventsForDate(cellDate);
    const visibleEvents = calendarView === "month" ? dayEvents.slice(0, 3) : dayEvents;
    visibleEvents.forEach((event) => {
      const chip = document.createElement("div");
      chip.className = "event-chip";
      chip.classList.add(roomClassName(event.room));
      chip.title = TEXT.editHint;
      chip.addEventListener("dblclick", () => openEditModal(event));
      const start = parseDateTimeValue(event.startAt);
      const end = parseDateTimeValue(event.endAt);
      if (!start || !end) {
        return;
      }
      chip.textContent = `${event.room} ${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")} - ${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")} ${event.booker}`;
      eventsContainer.append(chip);
    });

    if (calendarView === "month" && dayEvents.length > 3) {
      const more = document.createElement("div");
      more.className = "event-chip";
      more.textContent = IS_ENGLISH ? `${dayEvents.length - 3} ${TEXT.more}` : `${TEXT.more} ${dayEvents.length - 3} 件`;
      eventsContainer.append(more);
    }

    cell.append(dateLabel, eventsContainer);
    calendarGrid.append(cell);
  }
}

function openEditModal(item) {
  editIdInput.value = item.id;
  editRoomInput.value = item.room;
  editStartAtInput.value = item.startAt;
  editEndAtInput.value = item.endAt;
  editPurposeInput.value = item.purpose;
  editBookerInput.value = item.booker;
  editDeletePinInput.value = "";
  editModal.hidden = false;
  editPurposeInput.focus();
}

function closeEditModal() {
  editModal.hidden = true;
  editForm.reset();
}

function updateViewButtons() {
  viewButtons.forEach((button) => {
    const isActive = button.dataset.view === calendarView;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function renderReservationFormState() {
  form.hidden = !isReservationFormOpen;
  toggleFormButton.textContent = isReservationFormOpen ? TEXT.close : TEXT.open;
  toggleFormButton.setAttribute("aria-expanded", String(isReservationFormOpen));
  form.closest(".form-panel").classList.toggle("collapsed", !isReservationFormOpen);
}

function updateRepeatUntilState() {
  const isRepeated = repeatTypeInput.value !== "none";
  repeatUntilField.hidden = !isRepeated;
  repeatUntilInput.required = isRepeated;
  repeatUntilInput.disabled = !isRepeated;

  if (isRepeated && !repeatUntilInput.value) {
    repeatUntilInput.value = defaultRepeatUntilFor(startAtInput.value);
  }
}

function validateInput(room, startAt, endAt, purpose, booker, deletePin) {
  if (!room || !startAt || !endAt || !purpose || !booker || !deletePin) {
    alert(TEXT.allRequired);
    return false;
  }

  if (deletePin.length < 4) {
    alert(TEXT.pinLength);
    return false;
  }

  if (!ALLOWED_ROOMS.includes(room)) {
    alert(TEXT.invalidRoom);
    return false;
  }

  const start = toTimestamp(startAt);
  const end = toTimestamp(endAt);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    alert(TEXT.invalidDateFormat);
    return false;
  }

  if (start >= end) {
    alert(TEXT.endAfterStart);
    return false;
  }

  return true;
}

function validateRepeatInput(repeatType, startAt, repeatUntil) {
  if (repeatType === "none") {
    return true;
  }

  if (!["weekly", "biweekly", "monthly"].includes(repeatType)) {
    alert(TEXT.invalidRepeat);
    return false;
  }

  if (!repeatUntil) {
    alert(TEXT.repeatUntil);
    return false;
  }

  const start = parseDateTimeValue(startAt);
  const until = parseDateTimeValue(`${repeatUntil}T23:59`);
  if (!start || !until || start > until) {
    alert(TEXT.repeatAfterStart);
    return false;
  }

  return true;
}

function nextRepeatedStart(date, repeatType) {
  if (repeatType === "weekly") {
    return addDays(date, 7);
  }

  if (repeatType === "biweekly") {
    return addDays(date, 14);
  }

  return addMonthsClamped(date, 1);
}

function buildReservationEntries({ room, startAt, endAt, purpose, booker, deletePin, repeatType, repeatUntil }) {
  const start = parseDateTimeValue(startAt);
  const end = parseDateTimeValue(endAt);

  if (repeatType === "none") {
    return [{ room, startAt, endAt, purpose, booker, deletePin }];
  }

  const until = parseDateTimeValue(`${repeatUntil}T23:59`);
  const duration = end.getTime() - start.getTime();
  const entries = [];
  let currentStart = new Date(start);

  while (currentStart <= until && entries.length < 60) {
    const currentEnd = new Date(currentStart.getTime() + duration);
    entries.push({
      room,
      startAt: toDateTimeLocalValue(currentStart),
      endAt: toDateTimeLocalValue(currentEnd),
      purpose,
      booker,
      deletePin,
    });
    currentStart = nextRepeatedStart(currentStart, repeatType);
  }

  return entries;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const room = roomInput.value;
  const startAt = startAtInput.value;
  const endAt = endAtInput.value;
  const purpose = purposeInput.value.trim();
  const booker = bookerInput.value.trim();
  const deletePin = deletePinInput.value.trim();
  const repeatType = repeatTypeInput.value;
  const repeatUntil = repeatUntilInput.value;

  if (!validateInput(room, startAt, endAt, purpose, booker, deletePin)) {
    return;
  }

  if (!validateRepeatInput(repeatType, startAt, repeatUntil)) {
    return;
  }

  const newEntries = buildReservationEntries({
    room,
    startAt,
    endAt,
    purpose,
    booker,
    deletePin,
    repeatType,
    repeatUntil,
  });

  try {
    submitButton.disabled = true;
    const createdItems = [];
    for (const entry of newEntries) {
      createdItems.push(await createReservation(entry));
    }
    reservations.push(...createdItems);
    form.reset();
    roomInput.value = "31-205";
    shouldAutoUpdateEndAt = true;
    updateRepeatUntilState();
    isReservationFormOpen = false;
    renderReservationFormState();
    renderReservations();
    renderCalendar();
  } catch (error) {
    await fetchReservations();
    renderReservations();
    renderCalendar();
    alert(error instanceof Error ? error.message : TEXT.createFailed);
  } finally {
    submitButton.disabled = false;
  }
});

startAtInput.addEventListener("input", () => {
  updateDefaultEndAt();
  if (repeatTypeInput.value !== "none") {
    repeatUntilInput.value = defaultRepeatUntilFor(startAtInput.value);
  }
});

endAtInput.addEventListener("input", () => {
  shouldAutoUpdateEndAt = !endAtInput.value;
});

repeatTypeInput.addEventListener("change", updateRepeatUntilState);

toggleFormButton.addEventListener("click", () => {
  isReservationFormOpen = !isReservationFormOpen;
  renderReservationFormState();
});

prevMonthButton.addEventListener("click", () => {
  if (calendarView === "month") {
    displayDate = new Date(displayDate.getFullYear(), displayDate.getMonth() - 1, 1);
  } else if (calendarView === "week") {
    displayDate = addDays(displayDate, -7);
  } else {
    displayDate = addDays(displayDate, -1);
  }
  renderCalendar();
});

nextMonthButton.addEventListener("click", () => {
  if (calendarView === "month") {
    displayDate = new Date(displayDate.getFullYear(), displayDate.getMonth() + 1, 1);
  } else if (calendarView === "week") {
    displayDate = addDays(displayDate, 7);
  } else {
    displayDate = addDays(displayDate, 1);
  }
  renderCalendar();
});

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    calendarView = button.dataset.view;
    updateViewButtons();
    renderCalendar();
  });
});

editCancelButton.addEventListener("click", closeEditModal);

editModal.addEventListener("click", (event) => {
  if (event.target === editModal) {
    closeEditModal();
  }
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = editIdInput.value;
  const room = editRoomInput.value;
  const startAt = editStartAtInput.value;
  const endAt = editEndAtInput.value;
  const purpose = editPurposeInput.value.trim();
  const booker = editBookerInput.value.trim();
  const deletePin = editDeletePinInput.value.trim();

  if (!validateInput(room, startAt, endAt, purpose, booker, deletePin)) {
    return;
  }

  try {
    const updated = await updateReservation(id, { room, startAt, endAt, purpose, booker }, deletePin);
    reservations = reservations.map((item) => (item.id === id ? updated : item));
    closeEditModal();
    renderReservations();
    renderCalendar();
  } catch (error) {
    alert(error instanceof Error ? error.message : TEXT.updateFailed);
  }
});

editDeleteButton.addEventListener("click", async () => {
  const id = editIdInput.value;
  const deletePin = editDeletePinInput.value.trim();
  if (!deletePin) {
    alert(TEXT.pinPrompt);
    return;
  }

  try {
    await deleteReservation(id, deletePin);
    reservations = reservations.filter((item) => item.id !== id);
    closeEditModal();
    renderReservations();
    renderCalendar();
  } catch (error) {
    alert(error instanceof Error ? error.message : TEXT.deleteFailed);
  }
});

async function initialize() {
  try {
    await fetchReservations();
  } catch (error) {
    alert(error instanceof Error ? error.message : TEXT.fetchFailed);
  }

  renderReservations();
  renderReservationFormState();
  updateRepeatUntilState();
  updateViewButtons();
  renderCalendar();
}

initialize();
