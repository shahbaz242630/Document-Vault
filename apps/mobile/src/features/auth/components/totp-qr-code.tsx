import { QrCodeView } from "@/shared/ui/qr-code-view";

export function TotpQrCode({ otpauthUri }: { otpauthUri: string }) {
  return <QrCodeView accessibilityLabel="QR code for your authenticator app" data={otpauthUri} />;
}
