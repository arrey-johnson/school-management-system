import QRCode from "qrcode";

export async function lanQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 1, width: 180, errorCorrectionLevel: "M" });
}
