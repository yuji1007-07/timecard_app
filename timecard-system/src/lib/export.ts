import ExcelJS from "exceljs";
import type { AttendanceRow } from "@/lib/attendance";
import { daysInMonth, fmtTime, minutesToHhmm, minutesToHoursText, weekdayJa } from "@/lib/time";

/** CSV（Excelで文字化けしないよう BOM 付き UTF-8） */
export function buildCsv(rows: AttendanceRow[]): Buffer {
  const header = ["スタッフ名", "ブランド", "店舗", "日付", "曜日", "始業時刻", "休憩開始", "休憩終了", "終業時刻", "休憩時間", "実働時間", "備考"];
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.user.name,
        r.store.brand,
        r.store.name,
        r.workDate,
        weekdayJa(r.workDate),
        r.clockIn ? fmtTime(r.clockIn) : "",
        r.breakStart ? fmtTime(r.breakStart) : "",
        r.breakEnd ? fmtTime(r.breakEnd) : "",
        r.clockOut ? fmtTime(r.clockOut) : "",
        minutesToHhmm(r.breakMinutes),
        r.workMinutes != null ? minutesToHhmm(r.workMinutes) : "",
        r.note ?? "",
      ]
        .map(esc)
        .join(",")
    );
  }
  return Buffer.concat([Buffer.from("﻿", "utf8"), Buffer.from(lines.join("\r\n"), "utf8")]);
}

/** 勤務時間計算表（スタッフごとに1シート。旧システムのExcel出力と同じ体裁） */
export async function buildWorkbook(month: string, rows: AttendanceRow[]): Promise<Buffer> {
  const [year, monthNum] = month.split("-").map(Number);
  const days = daysInMonth(month);

  const grouped = new Map<string, { storeName: string; byDate: Map<string, AttendanceRow> }>();
  for (const r of rows) {
    const key = r.user.name;
    if (!grouped.has(key)) grouped.set(key, { storeName: r.store.name, byDate: new Map() });
    grouped.get(key)!.byDate.set(r.workDate, r);
  }

  const wb = new ExcelJS.Workbook();
  const headerFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } };
  const yellowFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7B2" } };
  const grayFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDED" } };
  const thin: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FF999999" } };
  const border: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };
  const center: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle" };

  const names = [...grouped.keys()].sort((a, b) => a.localeCompare(b, "ja"));
  for (const [idx, name] of names.entries()) {
    const info = grouped.get(name)!;
    const ws = wb.addWorksheet((name.replace(/[\\/?*[\]:]/g, "_").slice(0, 28) || `sheet${idx + 1}`));

    ws.mergeCells("A1:G1");
    ws.getCell("A1").value = `${year}年${monthNum}月勤務時間計算表`;
    ws.getCell("A1").font = { size: 18, bold: true };

    ws.getCell("B2").value = "氏 名";
    ws.getCell("C2").value = name;
    ws.getCell("F2").value = "店舗";
    ws.getCell("G2").value = info.storeName;
    for (const c of ["B2", "C2", "F2", "G2"]) {
      ws.getCell(c).border = border;
      ws.getCell(c).alignment = center;
    }
    ws.getCell("B2").fill = headerFill;
    ws.getCell("F2").fill = headerFill;
    ws.getCell("C2").fill = yellowFill;
    ws.getCell("G2").fill = yellowFill;

    const headers = ["日", "曜日", "始業時刻", "終業時刻", "休憩時間", "実働時間", "備考"];
    headers.forEach((h, i) => {
      const cell = ws.getCell(4, i + 1);
      cell.value = h;
      cell.fill = headerFill;
      cell.font = { bold: true };
      cell.alignment = center;
      cell.border = border;
    });

    let totalWork = 0;
    let workedDays = 0;
    for (let day = 1; day <= days; day++) {
      const rowIdx = 4 + day;
      const workDate = `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const rec = info.byDate.get(workDate);
      const values = [
        `${day}日`,
        weekdayJa(workDate),
        rec?.clockIn ? fmtTime(rec.clockIn) : "",
        rec?.clockOut ? fmtTime(rec.clockOut) : "",
        rec ? minutesToHhmm(rec.breakMinutes) : "",
        rec?.workMinutes != null ? minutesToHhmm(rec.workMinutes) : "",
        rec?.note ?? "",
      ];
      if (rec?.workMinutes) {
        totalWork += rec.workMinutes;
        workedDays += 1;
      }
      values.forEach((v, i) => {
        const cell = ws.getCell(rowIdx, i + 1);
        cell.value = v;
        cell.border = border;
        cell.alignment = i < 6 ? center : { vertical: "middle" };
        if (i === 2 || i === 3) cell.fill = yellowFill;
        else if (i === 4 || i === 5) cell.fill = grayFill;
      });
    }

    const sumRow = 6 + days;
    ws.getCell(sumRow, 1).value = "実働日数";
    ws.getCell(sumRow, 1).border = border;
    ws.getCell(sumRow, 2).value = workedDays;
    ws.getCell(sumRow, 2).border = border;
    ws.getCell(sumRow, 4).value = `${monthNum}月分`;
    ws.getCell(sumRow, 4).alignment = center;
    ws.getCell(sumRow, 5).value = "実働時間";
    ws.getCell(sumRow, 5).border = border;
    ws.getCell(sumRow, 6).value = minutesToHoursText(totalWork);
    ws.getCell(sumRow, 6).border = border;

    for (let c = 1; c <= 7; c++) ws.getColumn(c).width = 14;
    ws.getColumn(7).width = 24;
  }

  if (names.length === 0) {
    const ws = wb.addWorksheet("勤務表");
    ws.getCell("A1").value = `${month} の勤務データがありません`;
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
