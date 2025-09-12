/**
 * @fileoverview A reusable component for displaying a "tool" card on the dashboard.
 * Each card acts as a link to a specific feature or section of the application.
 * It is designed to be clickable and visually represent a tool with an icon and description.
 */

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "../ui/card";
import type { Tool } from "../../modules/core/types";
import { cn } from "../../lib/utils";

interface ToolCardProps {
  tool: Tool;
}

/**
 * Renders a single tool card.
 * The entire card is a clickable link that navigates to the tool's specified `href`.
 * It displays an icon, name, and description for the tool.
 * @param {ToolCardProps} props - The properties for the component.
 * @param {Tool} props.tool - The tool data object to render.
 * @returns {JSX.Element} A link-wrapped card component.
 */
export function ToolCard({ tool }: ToolCardProps) {
  const Icon = tool.icon;
  return (
    <Link href={tool.href} className="block h-full">
      <Card className="group h-full transform transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
        <CardHeader className="flex flex-row items-center gap-4">
          {Icon && (
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-lg", tool.bgColor)}>
                <Icon className={cn("h-6 w-6 text-white")} />
            </div>
          )}
          <div>
            <CardTitle className="text-lg">{tool.name}</CardTitle>
            <CardDescription className="line-clamp-2">{tool.description}</CardDescription>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
