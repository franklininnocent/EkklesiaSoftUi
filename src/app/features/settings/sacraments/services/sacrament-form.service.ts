/**
 * Sacrament Form Service
 * Shared form logic and utilities for sacrament forms
 */

import { Injectable } from '@angular/core';
import { Sacrament, SacramentType, SacramentCreateRequest } from '../models/sacrament.model';
import { DEFAULT_SACRAMENT_FORM, SacramentStatus, DATE_VALIDATION } from '../constants/sacrament.constants';

export interface SacramentFormData {
  [key: string]: string | number | undefined | null;
}

@Injectable({
  providedIn: 'root'
})
export class SacramentFormService {
  /**
   * Initialize form data with default values
   */
  initializeFormData(): SacramentFormData {
    return { ...DEFAULT_SACRAMENT_FORM };
  }

  /**
   * Populate form data from sacrament entity
   */
  populateFormFromSacrament(sacrament: Sacrament): SacramentFormData {
    const formData = this.initializeFormData();
    
    // Basic Information
    formData['sacrament_type_id'] = sacrament.sacrament_type_id;
    formData['recipient_name'] = sacrament.recipient_name || '';
    formData['date_administered'] = sacrament.date_administered || '';
    formData['place_administered'] = sacrament.place_administered || '';
    formData['status'] = sacrament.status || SacramentStatus.ACTIVE;

    // Minister Information
    formData['minister_name'] = sacrament.minister_name || '';
    formData['minister_title'] = sacrament.minister_title || '';

    // Certificate Information
    formData['certificate_number'] = sacrament.certificate_number || '';
    formData['book_number'] = sacrament.book_number || '';
    formData['page_number'] = sacrament.page_number || '';

    // Recipient Information
    formData['recipient_birth_date'] = this.formatDateForInput(sacrament.recipient_birth_date);
    formData['recipient_birth_place'] = sacrament.recipient_birth_place || '';
    formData['recipient_gender'] = sacrament.recipient_gender;

    // Parents Information
    formData['father_name'] = sacrament.father_name || '';
    formData['mother_name'] = sacrament.mother_name || '';

    // Godparents
    formData['godparent1_name'] = sacrament.godparent1_name || '';
    formData['godparent2_name'] = sacrament.godparent2_name || '';

    // Marriage Information
    formData['marriage_bride_full_name'] = sacrament.marriage_bride_full_name || '';
    formData['marriage_bride_father_name'] = sacrament.marriage_bride_father_name || '';
    formData['marriage_bride_mother_name'] = sacrament.marriage_bride_mother_name || '';
    formData['marriage_bride_address'] = sacrament.marriage_bride_address || '';
    formData['marriage_bride_church_type'] = sacrament.marriage_bride_church_type || 'home_parish';
    formData['marriage_bride_church_name'] = sacrament.marriage_bride_church_name || '';
    formData['marriage_bride_church_address'] = sacrament.marriage_bride_church_address || '';
    
    formData['marriage_groom_full_name'] = sacrament.marriage_groom_full_name || '';
    formData['marriage_groom_father_name'] = sacrament.marriage_groom_father_name || '';
    formData['marriage_groom_mother_name'] = sacrament.marriage_groom_mother_name || '';
    formData['marriage_groom_address'] = sacrament.marriage_groom_address || '';
    formData['marriage_groom_church_type'] = sacrament.marriage_groom_church_type || 'home_parish';
    formData['marriage_groom_church_name'] = sacrament.marriage_groom_church_name || '';
    formData['marriage_groom_church_address'] = sacrament.marriage_groom_church_address || '';

    // Additional Information
    formData['witnesses'] = sacrament.witnesses || '';
    formData['notes'] = sacrament.notes || '';

    return formData;
  }

  /**
   * Check if sacrament type is Marriage
   */
  isMarriage(sacramentType: SacramentType | number | undefined, sacramentTypes: SacramentType[]): boolean {
    if (!sacramentType) return false;
    
    let type: SacramentType | undefined;
    
    if (typeof sacramentType === 'number') {
      type = sacramentTypes.find(t => t.id === sacramentType);
    } else {
      type = sacramentType;
    }
    
    if (!type) return false;
    
    const code = (type.code || '').toString().toUpperCase().trim();
    const name = (type.name || '').toString().toUpperCase().trim();
    const marriageCodes = ['MARRIAGE', 'MATRIMONY', 'WEDDING'];
    
    return marriageCodes.includes(code) || marriageCodes.some(mc => name.includes(mc));
  }

  /**
   * Check if sacrament type is Baptism
   */
  isBaptism(sacramentType: SacramentType | number | undefined, sacramentTypes: SacramentType[]): boolean {
    if (!sacramentType) return false;
    
    let type: SacramentType | undefined;
    
    if (typeof sacramentType === 'number') {
      type = sacramentTypes.find(t => t.id === sacramentType);
    } else {
      type = sacramentType;
    }
    
    if (!type) return false;
    
    const code = (type.code || '').toString().toUpperCase().trim();
    const name = (type.name || '').toString().toUpperCase().trim();
    const baptismCodes = ['BAPTISM', 'BAPTISMO', 'BAPTIMAL', 'BAPTISE'];
    
    return baptismCodes.includes(code) || baptismCodes.some(bc => name.includes(bc));
  }

  /**
   * Build request payload from form data
   */
  buildRequestPayload(formData: SacramentFormData, tenantId: number, familyId?: string | null, bccId?: string | null): SacramentCreateRequest {
    // Helper function to safely convert to string or undefined
    const toStringOrUndefined = (value: string | number | undefined | null): string | undefined => {
      if (value === null || value === undefined) return undefined;
      const str = String(value).trim();
      return str === '' ? undefined : str;
    };

    // Helper function to safely convert to SacramentStatus
    const toSacramentStatus = (value: string | number | undefined | null): SacramentStatus => {
      if (value === null || value === undefined) return SacramentStatus.ACTIVE;
      const str = String(value).toLowerCase();
      if (str === 'active' || str === SacramentStatus.ACTIVE) return SacramentStatus.ACTIVE;
      if (str === 'cancelled' || str === SacramentStatus.CANCELLED) return SacramentStatus.CANCELLED;
      if (str === 'conditional' || str === SacramentStatus.CONDITIONAL) return SacramentStatus.CONDITIONAL;
      return SacramentStatus.ACTIVE;
    };

    // Helper function to safely convert to gender union type
    const toGender = (value: string | number | undefined | null): 'male' | 'female' | 'other' | undefined => {
      if (value === null || value === undefined) return undefined;
      const str = String(value).toLowerCase();
      if (str === 'male') return 'male';
      if (str === 'female') return 'female';
      if (str === 'other') return 'other';
      return undefined;
    };

    const payload: SacramentCreateRequest = {
      tenant_id: tenantId,
      sacrament_type_id: formData['sacrament_type_id'] as number,
      recipient_name: String(formData['recipient_name'] || ''),
      date_administered: String(formData['date_administered'] || ''),
      place_administered: toStringOrUndefined(formData['place_administered']),
      minister_name: toStringOrUndefined(formData['minister_name']),
      minister_title: toStringOrUndefined(formData['minister_title']),
      certificate_number: toStringOrUndefined(formData['certificate_number']),
      book_number: toStringOrUndefined(formData['book_number']),
      page_number: toStringOrUndefined(formData['page_number']),
      recipient_birth_date: toStringOrUndefined(formData['recipient_birth_date']),
      recipient_birth_place: toStringOrUndefined(formData['recipient_birth_place']),
      recipient_gender: toGender(formData['recipient_gender']),
      father_name: toStringOrUndefined(formData['father_name']),
      mother_name: toStringOrUndefined(formData['mother_name']),
      godparent1_name: toStringOrUndefined(formData['godparent1_name']),
      godparent2_name: toStringOrUndefined(formData['godparent2_name']),
      witnesses: toStringOrUndefined(formData['witnesses']),
      notes: toStringOrUndefined(formData['notes']),
      status: toSacramentStatus(formData['status'])
    };

    // Add family/BCC associations
    if (familyId) {
      payload.family_id = familyId;
    }
    if (bccId) {
      payload.bcc_id = bccId;
    }

    // Add marriage-specific fields if applicable
    if (formData['marriage_bride_full_name'] || formData['marriage_groom_full_name']) {
      const brideFullName = formData['marriage_bride_full_name'];
      const groomFullName = formData['marriage_groom_full_name'];
      
      if (brideFullName) {
        payload.marriage_bride_full_name = toStringOrUndefined(brideFullName);
        payload.marriage_bride_father_name = toStringOrUndefined(formData['marriage_bride_father_name']);
        payload.marriage_bride_mother_name = toStringOrUndefined(formData['marriage_bride_mother_name']);
        payload.marriage_bride_address = toStringOrUndefined(formData['marriage_bride_address']);
        const brideChurchType = formData['marriage_bride_church_type'];
        payload.marriage_bride_church_type = (brideChurchType === 'home_parish' || brideChurchType === 'other') 
          ? (brideChurchType as 'home_parish' | 'other') 
          : undefined;
        payload.marriage_bride_church_name = toStringOrUndefined(formData['marriage_bride_church_name']);
        payload.marriage_bride_church_address = toStringOrUndefined(formData['marriage_bride_church_address']);
      }
      
      if (groomFullName) {
        payload.marriage_groom_full_name = toStringOrUndefined(groomFullName);
        payload.marriage_groom_father_name = toStringOrUndefined(formData['marriage_groom_father_name']);
        payload.marriage_groom_mother_name = toStringOrUndefined(formData['marriage_groom_mother_name']);
        payload.marriage_groom_address = toStringOrUndefined(formData['marriage_groom_address']);
        const groomChurchType = formData['marriage_groom_church_type'];
        payload.marriage_groom_church_type = (groomChurchType === 'home_parish' || groomChurchType === 'other') 
          ? (groomChurchType as 'home_parish' | 'other') 
          : undefined;
        payload.marriage_groom_church_name = toStringOrUndefined(formData['marriage_groom_church_name']);
        payload.marriage_groom_church_address = toStringOrUndefined(formData['marriage_groom_church_address']);
      }
    }

    return payload;
  }

  /**
   * Get maximum date for date input (1 day in future)
   */
  getMaxDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + DATE_VALIDATION.MAX_FUTURE_DAYS);
    return tomorrow.toISOString().split('T')[0];
  }

  /**
   * Validate date is not too far in the future
   */
  validateDate(date: string): { valid: boolean; message?: string } {
    if (!date) {
      return { valid: false, message: 'Date is required' };
    }

    const adminDate = new Date(date);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + DATE_VALIDATION.MAX_FUTURE_DAYS);
    tomorrow.setHours(23, 59, 59, 999);

    if (adminDate > tomorrow) {
      return {
        valid: false,
        message: `The date cannot be more than ${DATE_VALIDATION.MAX_FUTURE_DAYS} day(s) in the future`
      };
    }

    return { valid: true };
  }

  /**
   * Format date for HTML date input (YYYY-MM-DD format)
   */
  formatDateForInput(dateValue: string | Date | null | undefined): string {
    if (!dateValue) return '';
    
    // If it's already a string in YYYY-MM-DD format, return it
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
      return dateValue.split('T')[0]; // Remove time portion if present
    }
    
    // If it's a Date object, format it
    if (dateValue instanceof Date) {
      const year = dateValue.getFullYear();
      const month = String(dateValue.getMonth() + 1).padStart(2, '0');
      const day = String(dateValue.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // Try to parse as date string
    try {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {
      // Invalid date
    }
    
    return '';
  }
}

