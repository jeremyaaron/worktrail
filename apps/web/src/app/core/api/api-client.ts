import { HttpClient, HttpParams, type HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CurrentUserService } from '../current-user.service';

export type ApiQueryParamValue = boolean | number | string | null | undefined;
export type ApiQueryParams = HttpParams | Record<string, ApiQueryParamValue>;

export interface ApiRequestOptions {
  params?: ApiQueryParams;
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly currentUser = inject(CurrentUserService);

  get<TResponse>(path: string, options: ApiRequestOptions = {}): Observable<TResponse> {
    return this.http.get<TResponse>(this.url(path), this.options(options));
  }

  getBlob(
    path: string,
    options: ApiRequestOptions = {}
  ): Observable<HttpResponse<Blob>> {
    return this.http.get(this.url(path), {
      ...this.options(options),
      observe: 'response',
      responseType: 'blob'
    });
  }

  post<TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    options: ApiRequestOptions = {}
  ): Observable<TResponse> {
    return this.http.post<TResponse>(this.url(path), body, this.options(options));
  }

  patch<TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    options: ApiRequestOptions = {}
  ): Observable<TResponse> {
    return this.http.patch<TResponse>(this.url(path), body, this.options(options));
  }

  delete<TResponse>(path: string, options: ApiRequestOptions = {}): Observable<TResponse> {
    return this.http.delete<TResponse>(this.url(path), this.options(options));
  }

  private url(path: string): string {
    return `${environment.apiBaseUrl}${path}`;
  }

  private options(input: ApiRequestOptions): {
    headers: Record<string, string>;
    params?: HttpParams;
  } {
    const params = this.toHttpParams(input.params);

    return {
      headers: this.currentUser.actorHeaders(),
      ...(params === undefined ? {} : { params })
    };
  }

  private toHttpParams(params: ApiQueryParams | undefined): HttpParams | undefined {
    if (params === undefined || params instanceof HttpParams) {
      return params;
    }

    let httpParams = new HttpParams();

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }

    return httpParams;
  }
}
