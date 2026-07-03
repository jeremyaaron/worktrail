import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

describe('App', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render shell navigation and current user selector', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const request = http.expectOne('/api/members');
    request.flush([
      {
        id: '10000000-0000-4000-8000-000000000101',
        workspaceId: '10000000-0000-4000-8000-000000000001',
        name: 'Avery Owner',
        email: 'avery.owner@example.com',
        role: 'owner',
        isActive: true
      }
    ]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand')?.textContent).toContain('Worktrail');
    expect(compiled.querySelector('nav a')?.textContent).toContain('Projects');
    expect(compiled.querySelector('select')?.textContent).toContain('Avery Owner');
  });
});
