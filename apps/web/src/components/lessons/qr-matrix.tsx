"use client";

import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { encode } from "uqr";

interface QrMatrixProps {
  value: string;
  sizeClass?: string;
}

/* ISO/IEC 18004 scannable QR code SVG rendered from the live share URL. */
export const QrMatrix = ({
  value,
  sizeClass = "size-36",
}: QrMatrixProps): ReactElement => {
  const [origin, setOrigin] = useState("http://localhost:3000");

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.origin) {
      setOrigin(window.location.origin);
    }
  }, []);

  const targetUrl = value.startsWith("/") ? `${origin}${value}` : value;
  const qr = encode(targetUrl, { ecc: "M", border: 2 });
  const side = qr.size;

  return (
    <div
      className={`rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[#fffdf9] p-2 ${sizeClass}`}
    >
      <svg
        role="img"
        aria-label={`Scannable QR code for ${targetUrl}`}
        viewBox={`0 0 ${side} ${side}`}
        shapeRendering="crispEdges"
        className="size-full"
      >
        <rect width={side} height={side} fill="#fffdf9" />
        {qr.data.map((row, y) =>
          row.map((dark, x) =>
            dark ? (
              <rect
                key={`${y}-${x}`}
                x={x}
                y={y}
                width={1}
                height={1}
                fill="#12161c"
              />
            ) : null,
          ),
        )}
      </svg>
    </div>
  );
};
