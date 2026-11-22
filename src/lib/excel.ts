export interface ExcelRow {
  name: string;
  isSchool: boolean;
  grade: string;
  attendance: Record<string, boolean>;
}

const ORDINALS = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة", "العاشرة"];

export async function downloadAttendanceExcel(opts: {
  title: string;
  sessions: number;
  rows: ExcelRow[];
  filename?: string;
}) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("سجل الحضور", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });

  const cols: { header: string; key: string; width: number }[] = [
    { header: "م", key: "n", width: 6 },
    { header: "الاسم الرباعي", key: "name", width: 38 },
    { header: "الانتماء", key: "aff", width: 18 },
    { header: "المرحلة الدراسية", key: "grade", width: 24 },
  ];
  for (let i = 1; i <= opts.sessions; i++) {
    cols.push({ header: `الجلسة ${ORDINALS[i - 1] ?? i}`, key: `s${i}`, width: 14 });
  }
  cols.push({ header: "إتمام جميع الجلسات", key: "done", width: 20 });
  ws.columns = cols;

  opts.rows.forEach((r, idx) => {
    const row: Record<string, string | number> = {
      n: idx + 1,
      name: r.name,
      aff: r.isSchool ? "من داخل المدرسة" : "من خارج المدرسة",
      grade: r.grade,
    };
    let all = true;
    for (let i = 1; i <= opts.sessions; i++) {
      const ok = !!r.attendance?.[String(i)];
      if (!ok) all = false;
      row[`s${i}`] = ok ? "حاضر" : "لم يحضر";
    }
    row.done = all ? "نعم" : "لا";
    ws.addRow(row);
  });

  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B2A6B" } };
  head.alignment = { horizontal: "center", vertical: "middle" };
  head.height = 24;
  ws.eachRow((row, i) => {
    row.eachCell((c) => {
      c.border = {
        top: { style: "thin", color: { argb: "FF88BCE3" } },
        bottom: { style: "thin", color: { argb: "FF88BCE3" } },
        left: { style: "thin", color: { argb: "FF88BCE3" } },
        right: { style: "thin", color: { argb: "FF88BCE3" } },
      };
      if (i > 1) c.alignment = { horizontal: "center", vertical: "middle" };
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${opts.filename ?? opts.title}.xlsx`.replace(/[\\/:*?"<>|]/g, "-");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
