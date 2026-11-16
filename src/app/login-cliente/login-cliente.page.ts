import { Component, inject } from '@angular/core';
import { addIcons } from 'ionicons';
import { logoGoogle, storefront } from 'ionicons/icons';
import { SessaoService } from '../core/services/sessao.service';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logoGoogle, storefront } from 'ionicons/icons';
import { Firebase } from '../services/firebase';

@Component({
    selector: 'app-login-cliente',
    templateUrl: './login-cliente.page.html',
    styleUrls: ['./login-cliente.page.scss'],
    imports: [IonContent, IonButton, IonIcon],
})
export class LoginClientePage implements OnInit {

    constructor() { addIcons({ logoGoogle, storefront }); }
    private router           = inject(Router)
    private firebase_service = inject(Firebase)

    async ngOnInit() {
        console.log("# login-cliente initialized")
        const is_loogged = await this.firebase_service.isLoggedIn()
        console.log("user looged in: "+is_loogged)

        if(is_loogged == false) return

        console.log("> User already logged in, redirecting to home")
        this.router.navigateByUrl('home/')
    }

    async login_google() {

        try {
            const user = await this.firebase_service.loginWithGoogle()
            if(!user) { return }
            console.log("Logged in as: ", user.displayName, user.email)
            await this.router.navigateByUrl('/home')

        } catch (error) {
            console.log("# Login failed\n## Error\n", error)
        }
    }

}
