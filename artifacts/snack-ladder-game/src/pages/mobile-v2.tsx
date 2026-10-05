import type { ReactNode } from 'react';

interface MobileV2PageProps {
  children: ReactNode;
}

export default function MobileV2Page({ children }: MobileV2PageProps) {
  return (
    <div className="mobile-v2-preview" data-testid="mobile-v2-preview">
      <div className="mobile-v2-preview__label" data-testid="mobile-v2-label">
        Mobile Version 2 · Chrome Preview
      </div>
      {children}
    </div>
  );
}
