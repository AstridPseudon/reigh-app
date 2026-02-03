// Navigator extensions for device/network info
interface NetworkInformation extends EventTarget {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

interface NavigatorWithDeviceInfo extends Navigator {
  deviceMemory?: number;
  connection?: NetworkInformation;
  standalone?: boolean; // iOS PWA
}

// Window extensions for debugging/instrumentation
declare global {
  interface Window {
    __supabase_client__?: import('@supabase/supabase-js').SupabaseClient;
    supabase?: import('@supabase/supabase-js').SupabaseClient;
    __AUTH_MANAGER__?: import('../integrations/supabase/auth/AuthStateManager').AuthStateManager;
    __REACT_QUERY_CLIENT__?: import('@tanstack/react-query').QueryClient;
    __SUPABASE_WEBSOCKET_INSTANCES__?: Map<string, WebSocket>;
    __PROJECT_CONTEXT__?: { selectedProjectId?: string; projects?: unknown[] };
    debugMobile?: () => void;
  }
}

export { NavigatorWithDeviceInfo, NetworkInformation };
