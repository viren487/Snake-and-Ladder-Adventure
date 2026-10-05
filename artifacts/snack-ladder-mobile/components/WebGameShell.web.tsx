import { useEffect, useRef } from 'react';
import { useWebGameShell } from '@/hooks/useWebGameShell';

export default function WebGameShell() {
  const shell = useWebGameShell();
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.origin !== window.location.origin && event.origin !== 'null') return;
      shell.persist(event.data);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [shell.persist]);
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#131726', display: 'flex', flexDirection: 'column' }}>
      {shell.loadError ? <div role="alert" style={{ padding: 24, color: '#f7f3e8' }}>
        Your saved round could not be read. It has not been replaced.
        <button onClick={shell.retryLoad}>Retry</button>
      </div> : shell.html ? <>
        {shell.saveError && <div role="alert" style={{ padding: 8, color: '#f7f3e8' }}>
          This round could not be saved. Keep the app open.
          <button onClick={shell.retrySave}>Retry save</button>
        </div>}
        <iframe ref={frame} srcDoc={shell.html} title="Snakes & Ladders — same web game"
          data-testid="shared-web-game" allow="autoplay; fullscreen"
          style={{ flex: 1, width: '100%', minHeight: 0, border: 0 }} />
      </> : <p role="status" style={{ padding: 24, color: '#f7f3e8' }}>Loading your saved round…</p>}
    </div>
  );
}