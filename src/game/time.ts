import { MONTHS } from "./defs";

export const WEEKS_PER_MONTH = 4;
export const WEEKS_PER_QUARTER = WEEKS_PER_MONTH * 3;
export const WEEKS_PER_YEAR = WEEKS_PER_MONTH * 12;
export const BASE_YEAR = 2026;

export function getMonthIndexFromWeek(week: number) {
  return Math.floor((week - 1) / WEEKS_PER_MONTH) + 1;
}

export function getQuarterIndexFromWeek(week: number) {
  return Math.floor((week - 1) / WEEKS_PER_QUARTER) + 1;
}

export function getYearFromWeek(week: number) {
  return BASE_YEAR + Math.floor((week - 1) / WEEKS_PER_YEAR);
}

export function isMonthEndWeek(week: number) {
  return week % WEEKS_PER_MONTH === 0;
}

export function isQuarterEndWeek(week: number) {
  return week % WEEKS_PER_QUARTER === 0;
}

export function isYearEndWeek(week: number) {
  return week % WEEKS_PER_YEAR === 0;
}

export function monthLabelFromWeek(week: number) {
  const monthIndex = getMonthIndexFromWeek(week);
  const idx = (monthIndex - 1) % MONTHS.length;
  const year = BASE_YEAR + Math.floor((monthIndex - 1) / MONTHS.length);
  return `${MONTHS[idx]} ${year}`;
}

export function weekLabel(week: number) {
  return `Week ${week}, ${monthLabelFromWeek(week)}`;
}
