import { Device } from '@capacitor/device';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

export interface DeviceInfo {
  device_id: string;
  platform: 'web' | 'android' | 'ios';
  app_version: string;
  os_version: string;
  device_model: string;
  device_manufacturer: string;
  user_agent: string;
  screen_resolution: string;
  language: string;
  timezone: string;
  is_virtual: boolean;
}

export async function collectDeviceInfo(deviceId: string): Promise<DeviceInfo> {
  const isWeb = Capacitor.getPlatform() === 'web';
  
  let platform: 'web' | 'android' | 'ios' = 'web';
  if (!isWeb) {
    platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  }

  const screenResolution = typeof window !== 'undefined' 
    ? `${window.screen.width}x${window.screen.height}` 
    : '';

  const language = typeof navigator !== 'undefined' ? navigator.language : '';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  if (isWeb) {
    return {
      device_id: deviceId,
      platform: 'web',
      app_version: '1.0.0', // Web doesn't have a specific native version
      os_version: '', // Hard to get reliably on web without parser
      device_model: '',
      device_manufacturer: '',
      user_agent: userAgent,
      screen_resolution: screenResolution,
      language,
      timezone,
      is_virtual: false
    };
  } else {
    const info = await Device.getInfo();
    const appInfo = await App.getInfo();
    
    return {
      device_id: deviceId,
      platform,
      app_version: appInfo.version,
      os_version: info.osVersion,
      device_model: info.model,
      device_manufacturer: info.manufacturer,
      user_agent: userAgent,
      screen_resolution: screenResolution,
      language,
      timezone,
      is_virtual: info.isVirtual
    };
  }
}

export async function registerDevice(info: DeviceInfo, userId?: string | null): Promise<void> {
  const payload = userId ? { ...info, user_id: userId } : info;
  
  const { error } = await supabase
    .from('user_devices')
    .upsert(payload, { onConflict: 'device_id' });
    
  if (error) {
    console.error('Failed to register device:', error);
  }
}

export async function claimDevice(deviceId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_devices')
    .update({ user_id: userId })
    .eq('device_id', deviceId);
    
  if (error) {
    console.error('Failed to claim device:', error);
  }
}

export async function listUserDeviceIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_devices')
    .select('device_id')
    .eq('user_id', userId);
    
  if (error) {
    console.error('Failed to fetch user devices:', error);
    return [];
  }
  
  return data.map(d => d.device_id);
}
