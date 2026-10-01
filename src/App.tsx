import { DiscoverySection } from './components/DiscoverySection';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { ResultsSection } from './components/ResultsSection';
import { TopNav } from './components/TopNav';
import { UndoToast } from './components/UndoToast';
import { BackgroundFX } from './components/Backdrop';
import { useDiscovery } from './hooks/useDiscovery';
import { useHidden } from './hooks/useHidden';
import { scrollToDiscovery } from './lib/scroll';
import type { ProviderId } from './providers/types';
import type { SelectedRelationType } from './types/domain';

export default function App() {
  const { state, busy, run, refresh } = useDiscovery();
  const { hidden, toast, hide, undo, showAll } = useHidden(
    state.username || null,
    state.provider,
  );

  const handleSubmit = (
    provider: ProviderId,
    username: string,
    relationTypes: SelectedRelationType[],
  ) => {
    void run(provider, username, relationTypes);
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-[#e6ebf3] font-body text-[#16233a] antialiased">
      <BackgroundFX />
      <div className="relative z-10 flex min-h-screen flex-col">
        <TopNav />
        <main id="content" className="flex-1">
          <Hero onStart={scrollToDiscovery} />
          <DiscoverySection busy={busy} onSubmit={handleSubmit} />
          <ResultsSection
            state={state}
            onRetry={scrollToDiscovery}
            onRefresh={() => void refresh()}
            hidden={hidden}
            onHide={hide}
            onShowAllHidden={showAll}
          />
        </main>
        <Footer />
        {toast && <UndoToast title={toast.title} onUndo={undo} />}
      </div>
    </div>
  );
}
