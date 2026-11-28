import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Lesson Studio · oku",
  description: "Generate, customize, and teach unit-grounded lessons and quizzes",
};

interface LessonsLayoutProps {
  children: ReactNode;
}

const LessonsLayout = ({ children }: LessonsLayoutProps): ReactNode => children;

export default LessonsLayout;
