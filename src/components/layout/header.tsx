/**
 * @fileoverview The main header component for the application's authenticated layout.
 * It displays the current page title and the user navigation menu.
 * It also includes a trigger to open the sidebar on mobile devices.
 */

import { SidebarTrigger } from "../ui/sidebar";
import { UserNav } from "./user-nav";

interface HeaderProps {
  title: string;
}

/**
 * Renders the main application header.
 * @param {HeaderProps} props - The properties for the component.
 * @param {string} props.title - The title to be displayed in the header, typically controlled by the current page.
 * @returns {JSX.Element} The header component.
 */
export function Header({ title }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-2xl font-semibold">{title}</h1>
      </div>
      <div className="ml-auto flex items-center gap-4">
        <UserNav />
      </div>
    </header>
  );
}
