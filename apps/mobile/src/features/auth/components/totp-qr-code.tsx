import { useMemo } from "react";
import { View } from "react-native";

import { createTotpQrMatrix } from "../totp-qr-matrix";

const QUIET_ZONE = 4;

/** Black on white whatever the theme, with the standard four-module quiet zone, so any authenticator can scan it. */
export function TotpQrCode({ otpauthUri, size = 216 }: { otpauthUri: string; size?: number }) {
  const matrix = useMemo(() => createTotpQrMatrix(otpauthUri), [otpauthUri]);
  const cell = Math.floor(size / (matrix.size + QUIET_ZONE * 2));
  const padding = cell * QUIET_ZONE;

  return (
    <View
      accessibilityLabel="QR code for your authenticator app"
      accessible
      style={{ backgroundColor: "#FFFFFF", borderRadius: 8, padding }}
    >
      {matrix.rows.map((runs, row) => (
        <View key={row} style={{ height: cell, width: cell * matrix.size }}>
          {runs.map((run) => (
            <View
              key={run.start}
              style={{
                backgroundColor: "#000000",
                height: cell,
                left: run.start * cell,
                position: "absolute",
                width: run.length * cell,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
