import { apiRequest } from './api';
import type { AuthResponse, MeContextResponse, OtpChannel, OtpRequestResponse } from './types';

export function requestPwaOtp(phone: string, channel: OtpChannel): Promise<OtpRequestResponse> {
  return apiRequest<OtpRequestResponse>('/auth/pwa/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, channel }),
  });
}

export function loginPwa(phone: string, otpCode: string, otpRequestId?: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/pwa/login', {
    method: 'POST',
    body: JSON.stringify({ phone, otpCode, otpRequestId }),
  });
}

export function getMeContext(accessToken: string): Promise<MeContextResponse> {
  return apiRequest<MeContextResponse>('/me/context', {
    method: 'GET',
    token: accessToken,
  });
}

export function setContextSelection(
  accessToken: string,
  payload: { activeChildId?: string; activeSectionId?: string },
): Promise<{ activeChildId?: string; activeSectionId?: string }> {
  return apiRequest<{ activeChildId?: string; activeSectionId?: string }>('/me/preferences/context', {
    method: 'POST',
    token: accessToken,
    body: JSON.stringify(payload),
  });
}
