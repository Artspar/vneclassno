export type UserRole = 'super_admin' | 'section_admin' | 'coach' | 'parent';

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    firstName: string;
    roles: string[];
  };
};

export type OtpChannel = 'sms' | 'telegram' | 'vk';

export type OtpRequestResponse = {
  requestId: string;
  channel: OtpChannel;
  expiresInSec: number;
  destinationMasked: string;
  debugCode?: string;
};

export type MeContextResponse = {
  userId: string;
  roles: UserRole[];
  hasLinkedPhone: boolean;
  hasLinkedTelegram: boolean;
  children: Array<{
    id: string;
    firstName: string;
    lastName: string;
  }>;
  sections: Array<{
    id: string;
    name: string;
  }>;
  activeChildId?: string;
  activeSectionId?: string;
};
