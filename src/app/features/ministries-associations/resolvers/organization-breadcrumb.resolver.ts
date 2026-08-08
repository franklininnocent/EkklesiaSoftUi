import { inject } from '@angular/core';
import { ResolveFn, ActivatedRouteSnapshot } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { MinistriesApiService } from '../services/ministries-api.service';

const FALLBACK_LABEL = 'Organization';

export const OrganizationBreadcrumbResolver: ResolveFn<string> = (route: ActivatedRouteSnapshot) => {
  const api = inject(MinistriesApiService);
  const id = route.paramMap.get('id');
  if (!id) {
    return of(FALLBACK_LABEL);
  }

  return api.getOrganization(id).pipe(
    map((res) => {
      const name = res?.data?.name?.trim();
      // #region agent log
      fetch('http://127.0.0.1:7631/ingest/5401a346-7001-4033-9c37-4ee605985cd9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c1da6e'},body:JSON.stringify({sessionId:'c1da6e',runId:'post-fix',hypothesisId:'A',location:'organization-breadcrumb.resolver.ts',message:'resolved organization breadcrumb label',data:{hasId:!!id,hasName:!!name,labelPreview:name?name.slice(0,48):FALLBACK_LABEL,isUuidFallback:/^[0-9a-f-]{20,}$/i.test(name||'')},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return name || FALLBACK_LABEL;
    }),
    catchError(() => of(FALLBACK_LABEL)),
  );
};
