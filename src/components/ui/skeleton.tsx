
import { Settings } from "lucide-react"
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted flex items-center justify-center",
        className
      )}
      {...props}
    >
      <Settings className="h-16 w-16 text-accent animate-spin" />
    </div>
  )
}

export { Skeleton }
