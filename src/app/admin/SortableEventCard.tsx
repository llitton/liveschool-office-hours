'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ReactNode } from 'react';

interface SortableEventCardProps {
  id: string;
  children: ReactNode;
  disabled?: boolean;
}

export default function SortableEventCard({
  id,
  children,
  disabled = false,
}: SortableEventCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: disabled ? 'default' : 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group/sortable">
      {/* Drag handle */}
      {!disabled && (
        <div
          {...attributes}
          {...listeners}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 opacity-0 group-hover/sortable:opacity-100 transition cursor-grab active:cursor-grabbing"
        >
          <div className="p-1.5 rounded hover:bg-[#F6F6F9]">
            <svg
              className="w-4 h-4 text-[#667085]"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
            </svg>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
