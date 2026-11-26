import { TestBed } from '@angular/core/testing';
import {
    THEME_DARK_CLASS,
    THEME_META_COLORS,
    THEME_STORAGE_KEY,
    ThemeService,
} from './theme.service';

const capacitorMocks = vi.hoisted(() => ({
    isNativePlatform: vi.fn(() => false),
    getPlatform: vi.fn(() => 'web'),
}));

const statusBarMocks = vi.hoisted(() => ({
    setStyle: vi.fn(() => Promise.resolve()),
    setBackgroundColor: vi.fn(() => Promise.resolve()),
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: capacitorMocks,
}));

vi.mock('@capacitor/status-bar', () => ({
    StatusBar: statusBarMocks,
    Style: {
        Dark: 'DARK',
        Light: 'LIGHT',
        Default: 'DEFAULT',
    },
}));

describe('ThemeService', () => {
    let originalMatchMedia: typeof window.matchMedia;
    let systemMatches = false;
    let mediaListeners: Array<(event: MediaQueryListEvent) => void> = [];
    let metaThemeColor: HTMLMetaElement;

    function installMatchMediaStub(initialMatches: boolean): void {
        systemMatches = initialMatches;
        mediaListeners = [];
        window.matchMedia = vi.fn((query: string) => ({
            get matches() {
                return systemMatches;
            },
            media: query,
            onchange: null,
            addListener: vi.fn((cb: (event: MediaQueryListEvent) => void) => {
                mediaListeners.push(cb);
            }),
            removeListener: vi.fn((cb: (event: MediaQueryListEvent) => void) => {
                mediaListeners = mediaListeners.filter((listener) => listener !== cb);
            }),
            addEventListener: vi.fn((_type: string, cb: EventListenerOrEventListenerObject) => {
                if (typeof cb === 'function') {
                    mediaListeners.push(cb as (event: MediaQueryListEvent) => void);
                }
            }),
            removeEventListener: vi.fn((_type: string, cb: EventListenerOrEventListenerObject) => {
                if (typeof cb === 'function') {
                    mediaListeners = mediaListeners.filter((listener) => listener !== cb);
                }
            }),
            dispatchEvent: vi.fn(() => false),
        })) as unknown as typeof window.matchMedia;
    }

    function emitSystemColorSchemeChange(matches: boolean): void {
        systemMatches = matches;
        const event = { matches } as MediaQueryListEvent;
        for (const listener of [...mediaListeners]) {
            listener(event);
        }
    }

    beforeEach(() => {
        localStorage.clear();
        document.documentElement.classList.remove(THEME_DARK_CLASS);
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.style.colorScheme = '';

        originalMatchMedia = window.matchMedia;
        installMatchMediaStub(false);

        metaThemeColor = document.createElement('meta');
        metaThemeColor.setAttribute('name', 'theme-color');
        metaThemeColor.setAttribute('content', '#ffffff');
        document.head.appendChild(metaThemeColor);

        capacitorMocks.isNativePlatform.mockReturnValue(false);
        capacitorMocks.getPlatform.mockReturnValue('web');
        statusBarMocks.setStyle.mockClear();
        statusBarMocks.setBackgroundColor.mockClear();
    });

    afterEach(() => {
        window.matchMedia = originalMatchMedia;
        metaThemeColor.remove();
        document.documentElement.classList.remove(THEME_DARK_CLASS);
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.style.colorScheme = '';
        localStorage.clear();
    });

    it('defaults to system preference and resolves to light when OS is light', () => {
        TestBed.configureTestingModule({});
        const service = TestBed.inject(ThemeService);
        service.initialize();

        expect(service.preference()).toBe('system');
        expect(service.resolvedTheme()).toBe('light');
        expect(service.isDark()).toBe(false);
        expect(document.documentElement.classList.contains(THEME_DARK_CLASS)).toBe(false);
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        expect(metaThemeColor.getAttribute('content')).toBe(THEME_META_COLORS.light);
    });

    it('resolves to dark on system preference when OS prefers dark', () => {
        installMatchMediaStub(true);
        TestBed.configureTestingModule({});
        const service = TestBed.inject(ThemeService);
        service.initialize();

        expect(service.preference()).toBe('system');
        expect(service.resolvedTheme()).toBe('dark');
        expect(service.isDark()).toBe(true);
        expect(document.documentElement.classList.contains(THEME_DARK_CLASS)).toBe(true);
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(document.documentElement.style.colorScheme).toBe('dark');
        expect(metaThemeColor.getAttribute('content')).toBe(THEME_META_COLORS.dark);
    });

    it('sets manual preference, persists to localStorage, and updates DOM attributes', () => {
        TestBed.configureTestingModule({});
        const service = TestBed.inject(ThemeService);
        service.initialize();

        service.setPreference('dark');
        expect(service.preference()).toBe('dark');
        expect(service.isDark()).toBe(true);
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
        expect(document.documentElement.classList.contains(THEME_DARK_CLASS)).toBe(true);
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(metaThemeColor.getAttribute('content')).toBe(THEME_META_COLORS.dark);

        service.setPreference('light');
        expect(service.preference()).toBe('light');
        expect(service.isDark()).toBe(false);
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
        expect(document.documentElement.classList.contains(THEME_DARK_CLASS)).toBe(false);
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        expect(metaThemeColor.getAttribute('content')).toBe(THEME_META_COLORS.light);
    });

    it('hydrates stored preference from localStorage and falls back to system on invalid values', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
        TestBed.configureTestingModule({});
        const darkService = TestBed.inject(ThemeService);
        darkService.initialize();
        expect(darkService.preference()).toBe('dark');
        expect(darkService.isDark()).toBe(true);

        TestBed.resetTestingModule();
        localStorage.setItem(THEME_STORAGE_KEY, 'invalid-value');
        TestBed.configureTestingModule({});
        const fallbackService = TestBed.inject(ThemeService);
        fallbackService.initialize();
        expect(fallbackService.preference()).toBe('system');
        expect(fallbackService.isDark()).toBe(false);
    });

    it('reacts to matchMedia change events only when preference is system', () => {
        TestBed.configureTestingModule({});
        const service = TestBed.inject(ThemeService);
        service.initialize();

        emitSystemColorSchemeChange(true);
        TestBed.flushEffects();
        expect(service.resolvedTheme()).toBe('dark');
        expect(document.documentElement.classList.contains(THEME_DARK_CLASS)).toBe(true);

        service.setPreference('light');
        TestBed.flushEffects();
        expect(service.resolvedTheme()).toBe('light');

        emitSystemColorSchemeChange(false);
        emitSystemColorSchemeChange(true);
        TestBed.flushEffects();
        expect(service.resolvedTheme()).toBe('light');
        expect(document.documentElement.classList.contains(THEME_DARK_CLASS)).toBe(false);
    });

    it('cycles preferences in system -> light -> dark -> system order', () => {
        TestBed.configureTestingModule({});
        const service = TestBed.inject(ThemeService);
        service.initialize();

        expect(service.preference()).toBe('system');
        service.cyclePreference();
        expect(service.preference()).toBe('light');
        service.cyclePreference();
        expect(service.preference()).toBe('dark');
        service.cyclePreference();
        expect(service.preference()).toBe('system');
    });

    it('syncs Capacitor StatusBar only on native platforms (including Android background color)', async () => {
        TestBed.configureTestingModule({});
        const service = TestBed.inject(ThemeService);
        service.initialize();

        expect(statusBarMocks.setStyle).not.toHaveBeenCalled();

        capacitorMocks.isNativePlatform.mockReturnValue(true);
        capacitorMocks.getPlatform.mockReturnValue('android');

        service.setPreference('dark');
        await Promise.resolve();
        expect(statusBarMocks.setStyle).toHaveBeenCalledWith({ style: 'DARK' });
        expect(statusBarMocks.setBackgroundColor).toHaveBeenCalledWith({
            color: THEME_META_COLORS.dark,
        });

        statusBarMocks.setBackgroundColor.mockClear();
        capacitorMocks.getPlatform.mockReturnValue('ios');
        service.setPreference('light');
        await Promise.resolve();
        expect(statusBarMocks.setStyle).toHaveBeenCalledWith({ style: 'LIGHT' });
        expect(statusBarMocks.setBackgroundColor).not.toHaveBeenCalled();
    });
});
