import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { IonButton, IonIcon, IonLabel, IonSegment, IonSegmentButton } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { contrastOutline, moonOutline, sunnyOutline } from 'ionicons/icons';
import { ThemePreference, ThemeService } from '../../services/theme.service';

const THEME_LABELS: Record<ThemePreference, string> = {
    system: 'Sistema',
    light: 'Claro',
    dark: 'Escuro',
};

/**
 * Decoupled theme control supporting either a compact cycle button or a 3-state segmented selector.
 */
@Component({
    selector: 'app-theme-toggle',
    templateUrl: './theme-toggle.component.html',
    styleUrls: ['./theme-toggle.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [IonButton, IonIcon, IonLabel, IonSegment, IonSegmentButton],
})
export class ThemeToggleComponent {
    private readonly themeService = inject(ThemeService);

    /** Visual presentation variant (`icon` for compact header button, `segmented` for 3-way selector). */
    readonly variant = input<'icon' | 'segmented'>('icon');

    /** Surface context (`default` on canvas, `overlay` over photographic banners). */
    readonly surface = input<'default' | 'overlay'>('default');

    /** Active theme preference signal (`system` | `light` | `dark`). */
    readonly preference = this.themeService.preference;

    /** Effective dark state signal. */
    readonly isDark = this.themeService.isDark;

    /** Icon matching the current theme preference. */
    readonly currentIcon = computed(() => {
        switch (this.preference()) {
            case 'light':
                return 'sunny-outline';
            case 'dark':
                return 'moon-outline';
            case 'system':
                return 'contrast-outline';
        }
    });

    /** Accessible label describing the active preference and interaction hint. */
    readonly ariaLabel = computed(() => {
        const label = THEME_LABELS[this.preference()];
        return `Tema: ${label}. Toque para alternar`;
    });

    constructor() {
        addIcons({ sunnyOutline, moonOutline, contrastOutline });
    }

    /**
     * Cycles through `system` -> `light` -> `dark` and triggers light haptic feedback on native devices.
     */
    onCycle(): void {
        this.themeService.cyclePreference();
        void this.triggerHaptic();
    }

    /**
     * Applies the chosen preference from the 3-state segmented control.
     *
     * @param event - Ionic segment change event carrying the selected theme preference.
     */
    onSegmentChange(event: CustomEvent<{ value?: unknown }>): void {
        const value = event.detail?.value;
        if (value === 'system' || value === 'light' || value === 'dark') {
            if (value !== this.preference()) {
                this.themeService.setPreference(value);
                void this.triggerHaptic();
            }
        }
    }

    private async triggerHaptic(): Promise<void> {
        if (!Capacitor.isNativePlatform()) {
            return;
        }
        try {
            await Haptics.impact({ style: ImpactStyle.Light });
        } catch {
            // Ignore haptics errors on unsupported devices.
        }
    }
}
