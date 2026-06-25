import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || 'SUNMI V2 POS').trim();
    const fcmToken = String(body.fcm_token || '').trim();

    if (fcmToken.length < 40) {
      return Response.json({ success: false, error: 'Invalid FCM token' }, { status: 400 });
    }

    if (!isSupabaseConfigured) {
      return Response.json({ success: true, preview: true });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('pos_devices')
      .upsert({
        name,
        fcm_token: fcmToken,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'fcm_token' });

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message || 'Register failed' }, { status: 500 });
  }
}
