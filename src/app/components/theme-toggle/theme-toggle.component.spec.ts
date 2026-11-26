import { Signal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { ThemePreference, ThemeService } from '../../services/theme.service';
import { ThemeToggleComponent } from './theme-toggle.component';

describe('ThemeToggleComponent', () => {
    let fixture: ComponentFixture<ThemeToggleComponent>;
    let preferenceSig: ReturnType<typeof signal<ThemePreference>>;
    let isDarkSig: ReturnType<typeof signal<boolean>>;
    let themeServiceMock: {
        preference: Signal<ThemePreference>;
        isDark: Signal<boolean>;
        cyclePreference: ReturnType<typeof vi.fn>;
        setPreference: ReturnType<typeof vi.fn>;
    };

    beforeEach(async () => {
        preferenceSig = signal<ThemePreference>('system');
        isDarkSig = signal(false);
        themeServiceMock = {
            preference: preferenceSig.asReadonly(),
            isDark: isDarkSig.asReadonly(),
            cyclePreference: vi.fn(),
            setPreference: vi.fn((pref: ThemePreference) => {
                preferenceSig.set(pref);
            }),
        };

        await TestBed.configureTestingModule({
            imports: [ThemeToggleComponent],
            providers: [
                provideIonicAngular(),
                { provide: ThemeService, useValue: themeServiceMock },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(ThemeToggleComponent);
    });

    it('renders icon variant with dynamic aria-label and cycles theme on click', () => {
        fixture.detectChanges();
        const button = fixture.nativeElement.querySelector('ion-button.theme-icon-btn') as HTMLElement | null;

        expect(button).toBeTruthy();
        expect(button?.getAttribute('aria-label')).toContain('Sistema');

        button?.click();
        expect(themeServiceMock.cyclePreference).toHaveBeenCalledTimes(1);

        preferenceSig.set('dark');
        fixture.detectChanges();
        expect(button?.getAttribute('aria-label')).toContain('Escuro');
    });

    it('renders segmented variant with 3 options and updates ThemeService on change', () => {
        fixture.componentRef.setInput('variant', 'segmented');
        fixture.detectChanges();

        const segment = fixture.nativeElement.querySelector('ion-segment.theme-segment') as HTMLElement | null;
        const buttons = fixture.nativeElement.querySelectorAll('ion-segment-button');

        expect(segment).toBeTruthy();
        expect(buttons.length).toBe(3);

        fixture.componentInstance.onSegmentChange(
            new CustomEvent('ionChange', { detail: { value: 'dark' } }),
        );
        expect(themeServiceMock.setPreference).toHaveBeenCalledWith('dark');
    });
});
