import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaInstallContextValue {
  canInstall: boolean;
  isInstalled: boolean;
  showFallback: boolean;
  promptInstall: () => Promise<void>;
  dismissInstallUi: () => void;
}

const PwaInstallContext = createContext<PwaInstallContextValue | undefined>(undefined);

const DISMISS_KEY = 'zazi-pwa-install-dismissed-until';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function isStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isIosSafari() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIosDevice =
    /iphone|ipad|ipod/.test(userAgent) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  const isSafariBrowser = /safari/.test(userAgent) && !/crios|fxios|edgios|chrome|android/.test(userAgent);
  return isIosDevice && isSafariBrowser;
}

function getDismissedState() {
  const rawValue = window.localStorage.getItem(DISMISS_KEY);
  const expiresAt = rawValue ? Number(rawValue) : 0;

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    window.localStorage.removeItem(DISMISS_KEY);
    return false;
  }

  return true;
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneMode());
  const [dismissed, setDismissed] = useState(() => getDismissedState());

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      console.info('[PWA] beforeinstallprompt captured');
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setDismissed(false);
      window.localStorage.removeItem(DISMISS_KEY);
    };

    const handleAppInstalled = () => {
      console.info('[PWA] appinstalled');
      setIsInstalled(true);
      setDeferredPrompt(null);
      setDismissed(false);
      window.localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const canInstall = !isInstalled && !dismissed && deferredPrompt !== null;
  const showFallback = !isInstalled && !dismissed && deferredPrompt === null && isIosSafari();

  useEffect(() => {
    if (canInstall) {
      console.info('[PWA] install button shown');
    }
  }, [canInstall]);

  useEffect(() => {
    if (showFallback) {
      console.info('[PWA] fallback mode activated');
    }
  }, [showFallback]);

  const dismissInstallUi = () => {
    const expiresAt = Date.now() + DISMISS_MS;
    window.localStorage.setItem(DISMISS_KEY, String(expiresAt));
    setDismissed(true);
    setDeferredPrompt(null);
  };

  const promptInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    console.info('[PWA] install button clicked');
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.info(`[PWA] prompt outcome: ${outcome}`);

    if (outcome === 'accepted') {
      setIsInstalled(true);
      window.localStorage.removeItem(DISMISS_KEY);
      setDismissed(false);
    } else {
      const expiresAt = Date.now() + DISMISS_MS;
      window.localStorage.setItem(DISMISS_KEY, String(expiresAt));
      setDismissed(true);
    }

    setDeferredPrompt(null);
  };

  const value = useMemo(
    () => ({
      canInstall,
      isInstalled,
      showFallback,
      promptInstall,
      dismissInstallUi,
    }),
    [canInstall, isInstalled, showFallback],
  );

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstall() {
  const context = useContext(PwaInstallContext);

  if (!context) {
    throw new Error('usePwaInstall must be used within PwaInstallProvider');
  }

  return context;
}