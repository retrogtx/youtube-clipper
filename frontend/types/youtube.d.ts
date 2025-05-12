declare namespace YT {
  interface PlayerOptions {
    height?: number | string;
    width?: number | string;
    videoId?: string;
    playerVars?: {
      autoplay?: 0 | 1;
      controls?: 0 | 1;
      start?: number;
      end?: number;
      [key: string]: any;
    };
  }

  class Player {
    constructor(elementId: HTMLElement | string, options: PlayerOptions);
    destroy(): void;
  }
} 