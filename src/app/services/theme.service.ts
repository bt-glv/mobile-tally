import { DOCUMENT, DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export const THEME_STORAGE_KEY = 'tally:tema';
export const THEME_DARK_CLASS = 'ion-palette-dark';
export const THEME_META_COLORS = {
    light: '#ffffff',
    dark: '#0f1218',
} as const;

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const CYCLE_ORDER: readonly ThemePreference[] = ['system', 'light', 'dark'];
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/**
 * Reactive theme engine managing light, dark, and system-synced preferences.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
    private readonly doc = inject(DOCUMENT);
    private readonly destroyRef = inject(DestroyRef);

    private readonly _preference = signal<ThemePreference>(this.readStoredPreference());
    private readonly _systemDark = signal<boolean>(this.readSystemDark());
    private initialized = false;

    /** Current user preference (`system`, `light`, or `dark`). */
    readonly preference = this._preference.asReadonly();

    /** Effective resolved theme applied to the DOM (`light` or `dark`). */
    readonly resolvedTheme = computed<ResolvedTheme>(() => {
        const pref = this._preference();
        if (pref === 'system') {
            return this._systemDark() ? 'dark' : 'light';
        }
        return pref;
    });

    /** Whether the effective theme is currently dark. */
    readonly isDark = computed<boolean>(() => this.resolvedTheme() === 'dark');

    constructor() {
        effect(() => {
            this.applyTheme(this.resolvedTheme());
        });
    }

    /**
     * Initializes system color-scheme tracking and synchronizes the DOM and native status bar.
     * Safe to invoke multiple times.
     */
    initialize(): void {
        if (!this.initialized) {
            this.initialized = true;
            this.registerMediaListener();
        }
        this.applyTheme(this.resolvedTheme());
    }

    /**
     * Sets and persists the user's theme preference.
     *
     * @param preference - Desired theme mode (`system`, `light`, or `dark`).
     */
    setPreference(preference: ThemePreference): void {
        this._preference.set(preference);
        this.writeStoredPreference(preference);
        this.applyTheme(this.resolvedTheme());
    }

    /**
     * Cycles through `system` -> `light` -> `dark` -> `system`.
     */
    cyclePreference(): void {
        const currentIndex = CYCLE_ORDER.indexOf(this._preference());
        const nextPreference = CYCLE_ORDER[(currentIndex + 1) % CYCLE_ORDER.length];
        this.setPreference(nextPreference);
    }

    /**
     * Explicitly toggles between `light` and `dark` based on the currently resolved theme.
     */
    toggleLightDark(): void {
        this.setPreference(this.isDark() ? 'light' : 'dark');
    }

    private registerMediaListener(): void {
        const win = this.doc.defaultView;
        if (!win || typeof win.matchMedia !== 'function') {
            return;
        }

        try {
            const mq = win.matchMedia(DARK_MEDIA_QUERY);
            this._systemDark.set(mq.matches);

            const onChange = (event: MediaQueryListEvent): void => {
                this._systemDark.set(event.matches);
            };

            if (typeof mq.addEventListener === 'function') {
                mq.addEventListener('change', onChange);
                this.destroyRef.onDestroy(() => mq.removeEventListener('change', onChange));
            } else if (typeof mq.addListener === 'function') {
                mq.addListener(onChange);
                this.destroyRef.onDestroy(() => mq.removeListener(onChange));
            }
        } catch {
            // Ignore environments without full matchMedia support.
        }
    }

    private applyTheme(theme: ResolvedTheme): void {
        const root = this.doc.documentElement;
        if (!root) {
            return;
        }

        const dark = theme === 'dark';
        root.classList.toggle(THEME_DARK_CLASS, dark);
        root.setAttribute('data-theme', theme);
        root.style.colorScheme = theme;

        const metaThemeColor = this.doc.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', THEME_META_COLORS[theme]);
        }

        void this.syncNativeStatusBar(theme);
    }

    private async syncNativeStatusBar(theme: ResolvedTheme): Promise<void> {
        if (!Capacitor.isNativePlatform()) {
            return;
        }

        try {
            await StatusBar.setStyle({
                style: theme === 'dark' ? Style.Dark : Style.Light,
            });

            if (Capacitor.getPlatform() === 'android') {
                await StatusBar.setBackgroundColor({
                    color: THEME_META_COLORS[theme],
                });
            }
        } catch {
            // Ignore status bar failures on unsupported devices or runtimes.
        }
    }

    private readSystemDark(): boolean {
        const win = this.doc.defaultView;
        if (!win || typeof win.matchMedia !== 'function') {
            return false;
        }
        try {
            return win.matchMedia(DARK_MEDIA_QUERY).matches;
        } catch {
            return false;
        }
    }

    private readStoredPreference(): ThemePreference {
        try {
            const raw = this.doc.defaultView?.localStorage?.getItem(THEME_STORAGE_KEY);
            if (raw === 'system' || raw === 'light' || raw === 'dark') {
                return raw;
            }
        } catch {
            // Ignore storage access errors (e.g., private browsing restrictions).
        }
        return 'system';
    }

    private writeStoredPreference(preference: ThemePreference): void {
        try {
            this.doc.defaultView?.localStorage?.setItem(THEME_STORAGE_KEY, preference);
        } catch {
            // Ignore storage quota or security errors.
        }
    }
}
