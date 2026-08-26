import type { HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "elevenlabs-convai": HTMLAttributes<HTMLElement> & {
        "agent-id": string;
        "dynamic-variables"?: string;
      };
    }
  }
}

export {};
