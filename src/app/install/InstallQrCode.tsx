"use client";

import { QRCodeSVG } from "qrcode.react";

type InstallQrCodeProps = {
  value: string;
};

export default function InstallQrCode({ value }: InstallQrCodeProps) {
  return (
    <QRCodeSVG
      value={value}
      size={214}
      bgColor="#ffffff"
      fgColor="#1a1c1c"
      level="M"
      marginSize={2}
      imageSettings={{
        src: "/logo.jpg",
        height: 42,
        width: 42,
        excavate: true,
      }}
    />
  );
}
