import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Lesson · oku",
  description: "View a published lesson on oku",
};

interface LessonLayoutProps {
  children: ReactNode;
}

const LessonLayout = ({ children }: LessonLayoutProps): ReactNode => children;

export default LessonLayout;
