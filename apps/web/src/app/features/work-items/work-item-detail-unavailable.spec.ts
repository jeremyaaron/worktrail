import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { WorkItemDetailPageComponent } from './work-item-detail-page.component';

describe('Unavailable current work item', () => {
  it('retains the bounded historical return destination when the current record is unavailable', async () => {
    const id = '00000000-0000-4000-8000-000000000100';
    const returnUrl = '/projects/00000000-0000-4000-8000-000000000002/cycles/00000000-0000-4000-8000-000000000003#cycle-result-heading';
    await TestBed.configureTestingModule({
      imports: [WorkItemDetailPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), {
        provide: ActivatedRoute, useValue: {
          paramMap: new BehaviorSubject(convertToParamMap({ workItemId: id })),
          snapshot: { paramMap: convertToParamMap({ workItemId: id }), queryParamMap: convertToParamMap({ returnUrl }), fragment: null }
        }
      }]
    }).compileComponents();
    const fixture = TestBed.createComponent(WorkItemDetailPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/members').flush([]);
    http.expectOne('/api/work-items/' + id).flush({ error: { message: 'Unavailable current record' } }, { status: 404, statusText: 'Not found' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Work item detail could not be loaded');
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('a')?.getAttribute('href')).toBe(returnUrl);
    http.verify({ ignoreCancelled: true });
  });
});
