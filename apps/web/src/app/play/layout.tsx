import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Class Quiz · oku",
  description: "Timed auto-graded class quiz on oku",
};

interface PlayLayoutProps {
  children: ReactNode;
}

const PlayLayout = ({ children }: PlayLayoutProps): ReactNode => children;

export default PlayLayout;
