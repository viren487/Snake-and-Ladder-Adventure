import { useEffect, useRef, useState } from 'react';
import { ExternalLink, RefreshCw, Smartphone, X } from 'lucide-react';
import './MobilePreview.css';

const previewUrl: string = import.meta.env.VITE_MOBILE_PREVIEW_URL || '';

export function MobilePreview() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(() =>
    new URLSearchParams(window.location.search).get('mobilePreview') === '1');
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!open || !previewUrl) return;
    dialog.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  useEffect(() => {
    if (!open || !previewUrl) return;
    setLoaded(false);
    setSlow(false);
  }, [open, reload]);

  useEffect(() => {
    if (!open || !previewUrl || loaded) return;
    const timer = window.setTimeout(() => setSlow(true), 25000);
    return () => window.clearTimeout(timer);
  }, [open, reload, loaded]);

  const changeOpen = (next: boolean) => {
    const url = new URL(window.location.href);
    if (next) url.searchParams.set('mobilePreview', '1');
    else url.searchParams.delete('mobilePreview');
    window.history.replaceState(window.history.state, '', url);
    setOpen(next);
  };

  // This is a development preview, not a public mobile build.
  if (!import.meta.env.DEV) return null;

  return (
    <>
      <div className="mobile-preview-launcher">
        <button type="button" data-testid="open-mobile-preview"
          onClick={() => changeOpen(true)}>
          <Smartphone size={18} aria-hidden="true" /> Mobile Preview
        </button>
        <span>Same native mobile app</span>
      </div>
      {open && (
        <dialog ref={dialog} className="mobile-preview-dialog"
          aria-labelledby="mobile-preview-title" data-testid="mobile-preview-dialog"
          onCancel={(event) => { event.preventDefault(); changeOpen(false); }}>
          <div className="mobile-preview-content">
            <header className="mobile-preview-header">
              <div>
                <h2 id="mobile-preview-title"><Smartphone size={18} /> Mobile Preview</h2>
                <p>Live native app · Keep the mobile server running</p>
              </div>
              <button type="button" className="mobile-preview-icon" onClick={() => changeOpen(false)}
                aria-label="Back to browser game" data-testid="close-mobile-preview">
                <X size={20} />
              </button>
            </header>
            {previewUrl ? (
              <>
                <nav className="mobile-preview-actions" aria-label="Mobile preview actions">
                  <button type="button" onClick={() => setReload((value) => value + 1)}
                    data-testid="reload-mobile-preview">
                    <RefreshCw size={15} /> Reload
                  </button>
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                    data-testid="open-mobile-browser">
                    <ExternalLink size={15} /> Open in browser
                  </a>
                </nav>
                {!loaded && <p className="mobile-preview-message" role="status">Loading mobile app…</p>}
                {slow && <p className="mobile-preview-message" role="status">
                  If the game is still missing, start the mobile server in the project, then tap Reload.
                </p>}
                <iframe key={reload} src={previewUrl} title="Snake & Ladder native mobile app"
                  data-testid="native-mobile-frame" allow="autoplay; fullscreen"
                  referrerPolicy="no-referrer" onLoad={() => { setLoaded(true); setSlow(false); }} />
              </>
            ) : (
              <p className="mobile-preview-message" role="alert">
                The secure mobile preview URL is unavailable. Start the mobile server and restart the browser preview.
                No old or insecure address has been opened.
              </p>
            )}
          </div>
        </dialog>
      )}
    </>
  );
}