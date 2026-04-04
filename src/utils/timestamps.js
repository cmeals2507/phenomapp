/**
 * timestamps.js — day-locked edit history for analyst-entered content.
 *
 * Storage format (JSON array in TEXT column):
 *   [{ date: "YYYY-MM-DD", first_edited_at: "HH:MM:SS" }, ...]
 *
 * Rules:
 *  - One entry per calendar day maximum.
 *  - first_edited_at records the wall-clock time of the FIRST edit on that day.
 *  - Array is ordered chronologically, oldest first.
 *
 * Used in: main.js IPC handlers for saveStageOutput, saveMeaningUnit, addMeaningUnit.
 * NOT called for saveMeaningUnitColor (color = structural tagging, not text entry).
 */

'use strict';

/**
 * @param {string|null} existingJson  Current value of the day_stamps column.
 * @param {string}      nowDate       Today as "YYYY-MM-DD".
 * @param {string}      nowTime       Current time as "HH:MM:SS".
 * @returns {string}    Updated JSON string.
 */
function updateDayStamps(existingJson, nowDate, nowTime) {
  let stamps = [];
  try {
    const parsed = JSON.parse(existingJson || '[]');
    stamps = Array.isArray(parsed) ? parsed : [];
  } catch {
    stamps = [];
  }

  const last = stamps[stamps.length - 1];
  if (last && last.date === nowDate) {
    // Already recorded today — return unchanged.
    return JSON.stringify(stamps);
  }

  stamps.push({ date: nowDate, first_edited_at: nowTime });
  return JSON.stringify(stamps);
}

module.exports = { updateDayStamps };
