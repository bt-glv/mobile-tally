import { Injectable, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { User } from 'firebase/auth';
import { Firebase } from '../services/firebase';

const MOCK_VENDEDOR_EMAIL = '';
const MOCK_VENDEDOR_SENHA = '';

/**
 * Mock helper responsible for seeding a seller user account in Firebase Authentication.
 */
@Injectable({ providedIn: 'root' })
export class VendedorUsuarioCriar {
    private readonly firebase = inject(Firebase);
    private readonly alertCtrl = inject(AlertController);

    /**
     * Creates the mock seller account in Firebase Authentication using `MOCK_VENDEDOR_EMAIL`
     * and `MOCK_VENDEDOR_SENHA`, presenting an Ionic confirmation alert on success.
     *
     * @returns The newly created Firebase `User`, or `null` if unavailable.
     */
    async criar(): Promise<User | null> {
        const user = await this.firebase.registerWithEmail(MOCK_VENDEDOR_EMAIL, MOCK_VENDEDOR_SENHA);
        if (user) {
            const alerta = await this.alertCtrl.create({
                header: 'Usuário criado',
                message: `Conta ${MOCK_VENDEDOR_EMAIL} criada com sucesso no Firebase.`,
                buttons: ['OK'],
            });
            await alerta.present();
        }

        return user;
    }
}
