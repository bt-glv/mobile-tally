import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { LoginClientePage } from './login-cliente.page';

describe('LoginClientePage', () => {
  let component: LoginClientePage;
  let fixture: ComponentFixture<LoginClientePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginClientePage],
      providers: [provideIonicAngular()],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginClientePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
