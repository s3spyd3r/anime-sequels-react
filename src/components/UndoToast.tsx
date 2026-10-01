import { motion } from 'framer-motion';
import { Undo2 } from 'lucide-react';

interface UndoToastProps {
  title: string;
  onUndo: () => void;
}

export function UndoToast({ title, onUndo }: UndoToastProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:inset-x-auto sm:right-6 sm:justify-end">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }}
        transition={{ duration: 0.3, ease: [0.21, 1.02, 0.73, 1] }}
        role="status"
        aria-live="polite"
        className="pointer-events-auto relative flex max-w-full items-center gap-4 overflow-hidden rounded-xl border border-[#d3dce8] bg-white px-4 py-3 shadow-[0_12px_40px_rgb(20_40_90/0.25)]"
      >
        <div className="absolute inset-x-0 top-0 h-0.5 bg-[#2e51a2]" />
        <p className="truncate text-sm text-[#16233a]">
          <span className="font-mono text-[13px] text-slate-500">“{title}”</span> hidden
        </p>
        <button
          type="button"
          onClick={onUndo}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#2e51a2] px-3.5 py-1.5 text-sm font-semibold text-white transition-all hover:bg-[#223f82] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2e51a2]"
        >
          <Undo2 className="size-3.5" />
          Undo
        </button>
      </motion.div>
    </div>
  );
}
