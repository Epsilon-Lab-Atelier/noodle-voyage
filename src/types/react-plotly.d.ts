declare module 'react-plotly.js' {
  import type { ComponentType, CSSProperties } from 'react';

  export interface PlotClickEvent {
    points: Array<{
      customdata?: unknown;
    }>;
  }

  export interface PlotProps {
    data: unknown[];
    layout?: Record<string, unknown>;
    config?: Record<string, unknown>;
    style?: CSSProperties;
    className?: string;
    useResizeHandler?: boolean;
    debug?: boolean;
    onClick?: (event: PlotClickEvent) => void;
  }

  const Plot: ComponentType<PlotProps>;
  export default Plot;
}
