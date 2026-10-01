import { useMemo } from "react";
import { View } from "react-native";

import { createQrMatrix } from "@/shared/qr/qr-matrix";

const QUIET_ZONE = 4;

/** Black on white whatever the theme, with the standard four-module quiet zone, so any scanner can read it. */
export function QrCodeView({ accessibilityLabel, data, size = 216 }: {
  accessibilityLabel: string; data: string; size?: number;
}) {
  const matrix = useMemo(() => createQrMatrix(data), [data]);
  const cell = Math.floor(size / (matrix.size + QUIET_ZONE * 2));
  const padding = cell * QUIET_ZONE;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
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
