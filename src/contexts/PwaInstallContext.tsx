import {
  createContext,
  useContext,
  useEffect,
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

function readDismissUntil() {
  try {
    return window.localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

function writeDismissUntil(value: string) {
  try {
    window.localStorage.setItem(DISMISS_KEY, value);
  } catch {
    console.info('[PWA] could not persist dismiss state');
  }
}

function clearDismissUntil() {
  try {
    window.localStorage.removeItem(DISMISS_KEY);
  } catch {
    console.info('[PWA] could not clear dismiss state');
  }
}

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
  const rawValue = readDismissUntil();
  const expiresAt = rawValue ? Number(rawValue) : 0;

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    clearDismissUntil();
    return false;
  }

  return true;
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneMode());
  const [dismissed, setDismissed] = useState(() => getDismissedState());

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const isAndroid = /android/i.test(ua);
    const isIos = /iphone|ipad|ipod/i.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    console.info(`[PWA] platform detected — iOS: ${isIos}, Android: ${isAndroid}, standalone: ${isStandaloneMode()}, iosSafari: ${isIosSafari()}`);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      console.info('[PWA] beforeinstallprompt captured');
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setDismissed(false);
      clearDismissUntil();
    };

    const handleAppInstalled = () => {
      console.info('[PWA] appinstalled');
      setIsInstalled(true);
      setDeferredPrompt(null);
      setDismissed(false);
      clearDismissUntil();
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
    writeDismissUntil(String(expiresAt));
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
      clearDismissUntil();
      setDismissed(false);
    } else {
      const expiresAt = Date.now() + DISMISS_MS;
      writeDismissUntil(String(expiresAt));
      setDismissed(true);
    }

    setDeferredPrompt(null);
  };

  return (
    <PwaInstallContext.Provider
      value={{
        canInstall,
        isInstalled,
        showFallback,
        promptInstall,
        dismissInstallUi,
      }}
    >
      {children}
    </PwaInstallContext.Provider>
  );
}

export function usePwaInstall() {
  const context = useContext(PwaInstallContext);

  if (!context) {
    throw new Error('usePwaInstall must be used within PwaInstallProvider');
  }

  return context;
}