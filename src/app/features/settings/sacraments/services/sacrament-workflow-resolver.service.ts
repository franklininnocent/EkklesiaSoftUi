import { Injectable } from '@angular/core';
import {
  SacramentDefinition,
  SacramentWorkflowPlan,
  SacramentWorkflowSectionKey,
} from '../models/sacrament-definition.model';

/**
 * Maps sacrament type → section keys for the modal shell.
 * Typed section components wire in Phase 6–7; this stub drives visibility only.
 */
@Injectable({
  providedIn: 'root',
})
export class SacramentWorkflowResolver {
  resolve(definition: SacramentDefinition | null, typeCode?: string | null): SacramentWorkflowPlan {
    const code = (definition?.code || typeCode || 'UNKNOWN').toUpperCase();

    if (!definition) {
      return {
        code,
        sections: ['basic', 'recipient', 'minister', 'registry', 'notes'],
        reviewRequired: false,
        batchSupported: false,
        definition: null,
      };
    }

    const sections: SacramentWorkflowSectionKey[] = ['basic'];

    const roles = new Set(definition.participants.map((p) => p.role));

    if (roles.has('recipient')) {
      sections.push('recipient');
    }
    if (roles.has('candidate')) {
      sections.push('candidate');
    }
    if (roles.has('bride')) {
      sections.push('bride');
    }
    if (roles.has('groom')) {
      sections.push('groom');
    }
    if (roles.has('father') || roles.has('mother')) {
      sections.push('parents');
    }
    if (roles.has('godfather') || roles.has('godmother')) {
      sections.push('godparents');
    }
    if (roles.has('sponsor')) {
      sections.push('sponsors');
    }
    if (roles.has('witness')) {
      sections.push('witnesses');
    }
    if (roles.has('minister')) {
      sections.push('minister');
    }
    if (roles.has('co_consecrator')) {
      sections.push('co_consecrators');
    }
    if ((definition.ordination_types?.length ?? 0) > 0) {
      sections.push('ordination');
    }
    if ((definition.event_subtypes?.length ?? 0) > 0) {
      sections.push('event_subtype');
    }
    if ((definition.place_classifications?.length ?? 0) > 0) {
      sections.push('place_classification');
    }
    if (definition.affiliation_independent_of_source) {
      sections.push('affiliation');
    }

    sections.push('registry', 'notes');

    if (definition.review_required) {
      sections.push('review');
    }

    return {
      code: definition.code,
      sections,
      reviewRequired: !!definition.review_required,
      batchSupported: !!definition.batch_supported,
      definition,
    };
  }

  hasSection(plan: SacramentWorkflowPlan | null, section: SacramentWorkflowSectionKey): boolean {
    return !!plan?.sections.includes(section);
  }
}
