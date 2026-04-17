export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDisplayDate(dateValue) {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export function monthOptions(count = 12) {
  const options = [];
  const current = new Date();

  for (let index = 0; index < count; index += 1) {
    const date = new Date(current.getFullYear(), current.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString(undefined, { year: "numeric", month: "long" });
    options.push({ value, label });
  }

  return options;
}

export function monthRange(monthValue) {
  const [yearPart, monthPart] = String(monthValue).split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);

  const start = `${yearPart}-${monthPart}-01`;
  const endDate = new Date(year, month, 0);
  const end = endDate.toISOString().slice(0, 10);

  return { start, end };
}
