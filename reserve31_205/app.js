const STORAGE_KEY = "reserve31_205_items";

const form = document.getElementById("reservation-form");
const startAtInput = document.getElementById("startAt");
const endAtInput = document.getElementById("endAt");
const purposeInput = document.getElementById("purpose");
const bookerInput = document.getElementById("booker");
const reservationList = document.getElementById("reservation-list");
const reservationTemplate = document.getElementById("reservation-item-template");
const calendarGrid = document.getElementById("calendar-grid");
const currentMonthLabel = document.getElementById("current-month");
const prevMonthButton = document.getElementById("prev-month");
const nextMonthButton = document.getElementById("next-month");

let reservations = loadReservations();
let displayDate = new Date();

function loadReservations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveReservations() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
}

function toDateTimeText(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString("ja-JP", {
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

function byStartAsc(a, b) {
  return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
}

function hasOverlap(candidate, currentId = null) {
  const start = new Date(candidate.startAt).getTime();
  const end = new Date(candidate.endAt).getTime();

  return reservations.some((item) => {
    if (currentId && item.id === currentId) {
      return false;
    }
    const itemStart = new Date(item.startAt).getTime();
    const itemEnd = new Date(item.endAt).getTime();
    return start < itemEnd && itemStart < end;
  });
}

function renderReservations() {
  reservationList.innerHTML = "";
  const sorted = [...reservations].sort(byStartAsc);

  if (sorted.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "予約はまだありません。";
    empty.className = "reservation-item";
    reservationList.append(empty);
    return;
  }

  sorted.forEach((item) => {
    const fragment = reservationTemplate.content.cloneNode(true);
    fragment.querySelector(".reservation-time").textContent =
      `${toDateTimeText(item.startAt)} - ${toDateTimeText(item.endAt)}`;
    fragment.querySelector(".reservation-purpose").textContent = `用途: ${item.purpose}`;
    fragment.querySelector(".reservation-booker").textContent = `予約者: ${item.booker}`;

    const deleteButton = fragment.querySelector(".delete-btn");
    deleteButton.addEventListener("click", () => {
      reservations = reservations.filter((entry) => entry.id !== item.id);
      saveReservations();
      renderReservations();
      renderCalendar();
    });

    reservationList.append(fragment);
  });
}

function eventsForDate(date) {
  return reservations
    .filter((item) => sameDay(new Date(item.startAt), date))
    .sort(byStartAsc);
}

function renderCalendar() {
  calendarGrid.innerHTML = "";

  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();
  currentMonthLabel.textContent = `${year}年 ${month + 1}月`;

  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const firstCellDate = new Date(year, month, 1 - startWeekday);

  for (let i = 0; i < 42; i += 1) {
    const cellDate = new Date(firstCellDate);
    cellDate.setDate(firstCellDate.getDate() + i);

    const cell = document.createElement("article");
    cell.className = "calendar-cell";

    if (cellDate.getMonth() !== month) {
      cell.classList.add("other-month");
    }

    const dateLabel = document.createElement("p");
    dateLabel.className = "date-label";
    dateLabel.textContent = `${cellDate.getMonth() + 1}/${cellDate.getDate()}`;

    const eventsContainer = document.createElement("div");
    eventsContainer.className = "day-events";

    const dayEvents = eventsForDate(cellDate);
    dayEvents.slice(0, 3).forEach((event) => {
      const chip = document.createElement("div");
      chip.className = "event-chip";
      const start = new Date(event.startAt);
      const end = new Date(event.endAt);
      chip.textContent = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")} - ${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")} ${event.booker}`;
      eventsContainer.append(chip);
    });

    if (dayEvents.length > 3) {
      const more = document.createElement("div");
      more.className = "event-chip";
      more.textContent = `ほか ${dayEvents.length - 3} 件`;
      eventsContainer.append(more);
    }

    cell.append(dateLabel, eventsContainer);
    calendarGrid.append(cell);
  }
}

function validateInput(startAt, endAt, purpose, booker) {
  if (!startAt || !endAt || !purpose || !booker) {
    alert("すべての項目を入力してください。");
    return false;
  }

  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    alert("日時の形式が正しくありません。");
    return false;
  }

  if (start >= end) {
    alert("終了日時は開始日時より後に設定してください。");
    return false;
  }

  return true;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const startAt = startAtInput.value;
  const endAt = endAtInput.value;
  const purpose = purposeInput.value.trim();
  const booker = bookerInput.value.trim();

  if (!validateInput(startAt, endAt, purpose, booker)) {
    return;
  }

  const newEntry = {
    id: crypto.randomUUID(),
    room: "31-205",
    startAt,
    endAt,
    purpose,
    booker,
  };

  if (hasOverlap(newEntry)) {
    alert("同じ時間帯にすでに予約があります。日時を変更してください。");
    return;
  }

  reservations.push(newEntry);
  saveReservations();

  form.reset();
  renderReservations();
  renderCalendar();
});

prevMonthButton.addEventListener("click", () => {
  displayDate = new Date(displayDate.getFullYear(), displayDate.getMonth() - 1, 1);
  renderCalendar();
});

nextMonthButton.addEventListener("click", () => {
  displayDate = new Date(displayDate.getFullYear(), displayDate.getMonth() + 1, 1);
  renderCalendar();
});

renderReservations();
renderCalendar();
