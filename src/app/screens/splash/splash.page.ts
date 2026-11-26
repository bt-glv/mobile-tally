import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { IonContent, NavController } from '@ionic/angular';
import { Firebase } from '../../services/firebase';
import { SessaoService } from '../../services/sessao.service';

export const SPLASH_DURATION_MS = 1350;
export const SPLASH_FADE_OUT_MS = 260;
export const AUTH_CHECK_TIMEOUT_MS = 1500;

/**
 * Initial splash screen displaying the Tally logo while checking Firebase authentication state.
 */
@Component({
    selector: 'app-splash',
    templateUrl: './splash.page.html',
    styleUrls: ['./splash.page.scss'],
    imports: [IonContent],
})
export class SplashPage implements OnInit, OnDestroy {
    private readonly firebase = inject(Firebase);
    private readonly sessao   = inject(SessaoService);
    private readonly nav      = inject(NavController);

    readonly saindo = signal(false);

    private destroyed = false;
    private timers: ReturnType<typeof setTimeout>[] = [];

    /**
     * Starts the splash display timer and background auth check.
     */
    ngOnInit(): void {
        void this.iniciarFluxo();
    }

    /**
     * Marks the component as destroyed and clears pending timers.
     */
    ngOnDestroy(): void {
        this.destroyed = true;
        for (const timer of this.timers) {
            clearTimeout(timer);
        }
        this.timers = [];
    }

    private async iniciarFluxo(): Promise<void> {
        const [, isLoggedIn] = await Promise.all([
            this.aguardar(SPLASH_DURATION_MS),
            this.verificarAutenticacao(),
        ]);

        if (this.destroyed) {
            return;
        }

        this.saindo.set(true);
        await this.aguardar(SPLASH_FADE_OUT_MS);

        if (this.destroyed) {
            return;
        }

        if (isLoggedIn && this.sessao.vendedor()) {
            await this.nav.navigateRoot('/vendedor/cartoes', { animated: false });
            return;
        }

        if (isLoggedIn) {
            this.sessao.entrarComGoogle();
            await this.nav.navigateRoot('/cliente', { animated: false });
            return;
        }

        await this.nav.navigateRoot('/login-cliente', { animated: false });
    }

    private async verificarAutenticacao(): Promise<boolean> {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<boolean>((resolve) => {
            timeoutId = setTimeout(() => resolve(false), AUTH_CHECK_TIMEOUT_MS);
            this.timers.push(timeoutId);
        });

        try {
            return await Promise.race([this.firebase.isLoggedIn(), timeout]);
        } catch {
            return false;
        } finally {
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
            }
        }
    }

    private aguardar(ms: number): Promise<void> {
        return new Promise((resolve) => {
            const timer = setTimeout(resolve, ms);
            this.timers.push(timer);
        });
    }
}
