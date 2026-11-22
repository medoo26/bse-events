import type { Coords } from "./types";

export interface CertData {
  templateUrl: string;
  name: string;
  content: string;
  nameCoords: Coords;
  contentCoords: Coords;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("تعذر تحميل قالب الشهادة"));
    img.src = url;
  });
}

function layer(text: string, c: Coords, W: number, weight: number) {
  const d = document.createElement("div");
  const width = (c.w / 100) * W;
  Object.assign(d.style, {
    position: "absolute",
    left: `${(c.x / 100) * W - width / 2}px`,
    top: `${c.y}%`,
    width: `${width}px`,
    transform: "translateY(-50%)",
    fontFamily: '"SST Arabic", sans-serif',
    fontWeight: String(weight),
    fontSize: `${(c.size / 100) * W}px`,
    lineHeight: "1.6",
    color: c.color,
    textAlign: c.align,
    direction: "rtl",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  } as Partial<CSSStyleDeclaration>);
  d.textContent = text;
  return d;
}

/** يحوّل الشهادة إلى PDF بجودة عالية بعد التأكد من تحميل خطوط SST Arabic بالكامل */
export async function downloadCertificatePdf(data: CertData, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

  await Promise.all([
    document.fonts.load('700 40px "SST Arabic"'),
    document.fonts.load('500 40px "SST Arabic"'),
    document.fonts.load('400 40px "SST Arabic"'),
  ]);
  await document.fonts.ready;

  const img = await loadImage(data.templateUrl);
  // مقاس التصيير ثابت ويعتمد على القالب فقط (لا على شاشة الجهاز ولا devicePixelRatio).
  // نحدد الحد الأعلى لعدد البكسلات حتى لا يتجاوز حد Canvas في Safari/iOS (~16.7 مليون بكسل).
  const MAX_PIXELS = 12_000_000;
  const MAX_SIDE = 4000;
  const k = Math.min(1, Math.sqrt(MAX_PIXELS / (img.naturalWidth * img.naturalHeight)), MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.round(img.naturalWidth * k);
  const H = Math.round(img.naturalHeight * k);

  const root = document.createElement("div");
  Object.assign(root.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: `${W}px`,
    height: `${H}px`,
    overflow: "hidden",
    background: "#fff",
  } as Partial<CSSStyleDeclaration>);
  const bg = img.cloneNode() as HTMLImageElement;
  bg.crossOrigin = "anonymous";
  Object.assign(bg.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
  root.appendChild(bg);
  root.appendChild(layer(data.name, data.nameCoords, W, 700));
  if (data.content.trim()) root.appendChild(layer(data.content, data.contentCoords, W, 500));
  document.body.appendChild(root);

  try {
    const canvas = await html2canvas(root, {
      scale: 1,
      useCORS: true,
      backgroundColor: "#ffffff",
      width: W,
      height: H,
      scrollX: 0,
      scrollY: 0,
      logging: false,
    });
    // مقاس الصفحة ثابت بالمليمتر: عرض A4 (297 أفقي / 210 عمودي) والارتفاع بحسب نسبة القالب
    const pageW = W >= H ? 297 : 210;
    const pageH = +((pageW * H) / W).toFixed(2);
    const pdf = new jsPDF({
      orientation: W >= H ? "landscape" : "portrait",
      unit: "mm",
      format: [pageW, pageH],
      compress: true,
    });
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, pageW, pageH);
    pdf.save(filename.replace(/[\\/:*?"<>|]/g, "-").replace(/\.pdf$/i, "") + ".pdf");
  } finally {
    root.remove();
  }
}
