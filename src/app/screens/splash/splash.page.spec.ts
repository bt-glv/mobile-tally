import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavController, provideIonicAngular } from '@ionic/angular';
import { Firebase } from '../../services/firebase';
import { SessaoService } from '../../services/sessao.service';
import { AUTH_CHECK_TIMEOUT_MS, SPLASH_DURATION_MS, SPLASH_FADE_OUT_MS, SplashPage } from './splash.page';

describe('SplashPage', () => {
    let fixture: ComponentFixture<SplashPage>;
    let firebaseMock: { isLoggedIn: ReturnType<typeof vi.fn> };
    let sessaoMock: { vendedor: ReturnType<typeof signal<unknown>>; entrarComGoogle: ReturnType<typeof vi.fn> };
    let navMock: { navigateRoot: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        vi.useFakeTimers();

        firebaseMock = {
            isLoggedIn: vi.fn().mockResolvedValue(false),
        };
        sessaoMock = {
            vendedor: signal(null),
            entrarComGoogle: vi.fn(),
        };
        navMock = {
            navigateRoot: vi.fn().mockResolvedValue(true),
        };

        await TestBed.configureTestingModule({
            imports: [SplashPage],
            providers: [
                provideIonicAngular(),
                { provide: Firebase, useValue: firebaseMock },
                { provide: SessaoService, useValue: sessaoMock },
                { provide: NavController, useValue: navMock },
            ],
        }).compileComponents();
    });

    afterEach(() => {
        fixture?.destroy();
        vi.useRealTimers();
    });

    function createComponent(): SplashPage {
        fixture = TestBed.createComponent(SplashPage);
        fixture.detectChanges();
        return fixture.componentInstance;
    }

    it('renders the logo asset and app title', () => {
        createComponent();
        const el = fixture.nativeElement as HTMLElement;
        const img = el.querySelector('img.splash-logo') as HTMLImageElement | null;
        const title = el.querySelector('h1.app-title');

        expect(img?.getAttribute('src')).toBe('assets/icon/logo-tally.svg');
        expect(title?.textContent?.trim()).toBe('Tally');
    });

    it('navigates to /login-cliente after splash when unauthenticated', async () => {
        firebaseMock.isLoggedIn.mockResolvedValue(false);
        createComponent();

        await vi.advanceTimersByTimeAsync(SPLASH_DURATION_MS);
        expect(navMock.navigateRoot).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(SPLASH_FADE_OUT_MS);
        expect(navMock.navigateRoot).toHaveBeenCalledWith('/login-cliente', { animated: false });
    });

    it('initializes customer session and navigates to /cliente when authenticated as customer', async () => {
        firebaseMock.isLoggedIn.mockResolvedValue(true);
        sessaoMock.vendedor.set(null);
        createComponent();

        await vi.advanceTimersByTimeAsync(SPLASH_DURATION_MS);
        await vi.advanceTimersByTimeAsync(SPLASH_FADE_OUT_MS);

        expect(sessaoMock.entrarComGoogle).toHaveBeenCalledTimes(1);
        expect(navMock.navigateRoot).toHaveBeenCalledWith('/cliente', { animated: false });
    });

    it('navigates to /vendedor/cartoes without calling entrarComGoogle when authenticated as seller', async () => {
        firebaseMock.isLoggedIn.mockResolvedValue(true);
        sessaoMock.vendedor.set({ id: 'V-01' });
        createComponent();

        await vi.advanceTimersByTimeAsync(SPLASH_DURATION_MS);
        await vi.advanceTimersByTimeAsync(SPLASH_FADE_OUT_MS);

        expect(sessaoMock.entrarComGoogle).not.toHaveBeenCalled();
        expect(navMock.navigateRoot).toHaveBeenCalledWith('/vendedor/cartoes', { animated: false });
    });

    it('falls back to /login-cliente when isLoggedIn rejects', async () => {
        firebaseMock.isLoggedIn.mockRejectedValue(new Error('auth error'));
        createComponent();

        await vi.advanceTimersByTimeAsync(SPLASH_DURATION_MS);
        await vi.advanceTimersByTimeAsync(SPLASH_FADE_OUT_MS);

        expect(navMock.navigateRoot).toHaveBeenCalledWith('/login-cliente', { animated: false });
    });

    it('falls back to /login-cliente when isLoggedIn hangs past timeout', async () => {
        firebaseMock.isLoggedIn.mockReturnValue(new Promise<boolean>(() => undefined));
        createComponent();

        await vi.advanceTimersByTimeAsync(AUTH_CHECK_TIMEOUT_MS);
        await vi.advanceTimersByTimeAsync(SPLASH_FADE_OUT_MS);

        expect(navMock.navigateRoot).toHaveBeenCalledWith('/login-cliente', { animated: false });
    });

    it('cancels navigation if destroyed before splash finishes', async () => {
        firebaseMock.isLoggedIn.mockResolvedValue(false);
        createComponent();

        await vi.advanceTimersByTimeAsync(SPLASH_DURATION_MS / 2);
        fixture.destroy();
        await vi.advanceTimersByTimeAsync(SPLASH_DURATION_MS + SPLASH_FADE_OUT_MS);

        expect(navMock.navigateRoot).not.toHaveBeenCalled();
    });
});
