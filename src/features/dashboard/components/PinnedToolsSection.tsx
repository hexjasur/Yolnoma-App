import { useState, useRef, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { GripVertical } from "lucide-react";
import { handleDevFeatureClick } from "@/config/features";
import { TOOL_CATALOG } from "@/config/toolCatalog";
import { ToolIcon } from "@/config/ToolIcon";
import { useAuth } from "@/features/auth/AuthContext";

interface PinnedToolsSectionProps {
  pinnedTools: string[];
  reorderPinnedTools: (source: string, target: string) => void;
}

export default function PinnedToolsSection({
  pinnedTools,
  reorderPinnedTools,
}: PinnedToolsSectionProps) {
  const { user } = useAuth();
  const [draggedToolId, setDraggedToolId] = useState<string | null>(null);
  const [dragOverToolId, setDragOverToolId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);

  const handleToolDragStart = (
    event: DragEvent<HTMLDivElement>,
    toolId: string,
  ) => {
    isDraggingRef.current = true;
    setDraggedToolId(toolId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", toolId);
  };

  const handleToolDragOver = (
    event: DragEvent<HTMLDivElement>,
    targetToolId: string,
  ) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverToolId !== targetToolId) {
      setDragOverToolId(targetToolId);
    }
  };

  const handleToolDrop = (
    event: DragEvent<HTMLDivElement>,
    targetToolId: string,
  ) => {
    event.preventDefault();
    setDragOverToolId(null);
    const sourceToolId =
      event.dataTransfer.getData("text/plain") || draggedToolId;

    if (sourceToolId && sourceToolId !== targetToolId) {
      reorderPinnedTools(sourceToolId, targetToolId);
    }
    setDraggedToolId(null);
  };

  const handleToolDragEnd = () => {
    setDraggedToolId(null);
    setDragOverToolId(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 150);
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
        Tools
      </h2>
      {pinnedTools.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.12] bg-[#111109] p-8 text-center">
          <p className="text-sm font-medium text-white/70">
            No favorite tools yet
          </p>
          <p className="mt-1 text-xs text-white/40">
            Add tools from the Sidebar to show them here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pinnedTools.map((toolId) => {
            const tool = TOOL_CATALOG.find(
              (candidate) => candidate.id === toolId,
            );
            if (!tool) return null;
            const isDragged = draggedToolId === tool.id;
            const isDragOver = dragOverToolId === tool.id && !isDragged;

            return (
              <div
                key={tool.id}
                draggable
                onDragStart={(event) => handleToolDragStart(event, tool.id)}
                onDragOver={(event) => handleToolDragOver(event, tool.id)}
                onDragLeave={() =>
                  setDragOverToolId((prev) => (prev === tool.id ? null : prev))
                }
                onDrop={(event) => handleToolDrop(event, tool.id)}
                onDragEnd={handleToolDragEnd}
                className={`group rounded-2xl border p-5 transition-all duration-200 flex items-center gap-3.5 shadow-lg select-none ${
                  isDragged
                    ? "opacity-35 scale-95 border-dashed border-[var(--accent)] bg-black/40 cursor-grabbing"
                    : isDragOver
                      ? "border-[var(--accent)] bg-[var(--accent-glow)] ring-2 ring-[var(--accent)]/40 scale-[1.02] cursor-grab"
                      : "border-white/[0.08] bg-[#111109] hover:border-[var(--accent-border)] hover:bg-white/[0.02] cursor-grab"
                }`}
              >
                <Link
                  to={tool.to}
                  draggable={false}
                  onClick={(event) => {
                    if (isDraggingRef.current) {
                      event.preventDefault();
                      return;
                    }
                    handleDevFeatureClick(event, tool.id, user?.role);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3.5 pointer-events-auto"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] text-[var(--accent)] flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                    <ToolIcon
                      icon={tool.icon}
                      className="h-5 w-5 object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white group-hover:text-[var(--accent)] transition-colors truncate">
                      {tool.label}
                    </p>
                    <p className="text-xs text-white/40 truncate">
                      {tool.description}
                    </p>
                  </div>
                </Link>
                <div
                  title="Drag to reorder"
                  className="ml-auto shrink-0 p-1 cursor-grab active:cursor-grabbing text-white/35 hover:text-[var(--accent)] transition-colors"
                >
                  <GripVertical size={18} aria-label="Drag to reorder" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
