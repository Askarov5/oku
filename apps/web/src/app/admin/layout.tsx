import { ThemeShell } from "@oku/ui";
import type { ReactElement, ReactNode } from "react";
import { LibraryRail } from "@/components/library-rail";

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps): ReactElement => (
  <ThemeShell title="Digital Library" rail={<LibraryRail />}>
    {children}
  </ThemeShell>
);

export default AdminLayout;
