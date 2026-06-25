package com.teeuan.shabuwrapper;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;

public class TeeUanMessagingService extends FirebaseMessagingService {
    public static final String PREFS_NAME = "TeeUanPrefs";
    public static final String PREF_FCM_TOKEN = "fcm_token";
    public static final String CHANNEL_ID = "tee_uan_staff_calls";
    private static final String TAG = "TeeUanFCM";
    private static final String DEFAULT_REGISTER_BASE_URL = "https://teeauansuki-app.vercel.app";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "FCM token updated: " + token);
        saveToken(token);
        registerToken(this, token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        super.onMessageReceived(message);
        Log.d(TAG, "FCM message received. data=" + message.getData());

        Map<String, String> data = message.getData();
        String title = valueOrDefault(data.get("title"), "Tee Uan Staff Call");
        String body = valueOrDefault(data.get("body"), buildBody(data));

        if (message.getNotification() != null) {
            title = valueOrDefault(message.getNotification().getTitle(), title);
            body = valueOrDefault(message.getNotification().getBody(), body);
        }

        showNotification(this, title, body);
    }

    private void saveToken(String token) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(PREF_FCM_TOKEN, token).apply();
    }

    public static void registerToken(Context context, String token) {
        if (token == null || token.trim().isEmpty()) return;

        Context appContext = context.getApplicationContext();
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                String registerUrl = getRegisterUrl(appContext);
                JSONObject payload = new JSONObject();
                payload.put("name", Build.MANUFACTURER + " " + Build.MODEL);
                payload.put("fcm_token", token);

                byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
                connection = (HttpURLConnection) new URL(registerUrl).openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(10000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                connection.setRequestProperty("Accept", "application/json");
                connection.setFixedLengthStreamingMode(body.length);

                try (OutputStream outputStream = connection.getOutputStream()) {
                    outputStream.write(body);
                }

                int status = connection.getResponseCode();
                Log.d(TAG, "POS token register status: " + status);
            } catch (Exception error) {
                Log.w(TAG, "POS token register failed", error);
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        }).start();
    }

    private static String getRegisterUrl(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String serverUrl = prefs.getString("server_url", DEFAULT_REGISTER_BASE_URL);
        try {
            Uri uri = Uri.parse(serverUrl);
            if (uri.getScheme() == null || uri.getHost() == null) {
                return DEFAULT_REGISTER_BASE_URL + "/api/pos-devices/register";
            }
            Uri.Builder builder = new Uri.Builder()
                    .scheme(uri.getScheme())
                    .encodedAuthority(uri.getEncodedAuthority())
                    .path("/api/pos-devices/register");
            return builder.build().toString();
        } catch (Exception error) {
            return DEFAULT_REGISTER_BASE_URL + "/api/pos-devices/register";
        }
    }

    private String buildBody(Map<String, String> data) {
        String tableNumber = data.get("table_number");
        if (tableNumber == null || tableNumber.trim().isEmpty()) {
            return "A customer is calling staff.";
        }
        return "Table " + tableNumber + " is calling staff.";
    }

    private String valueOrDefault(String value, String fallback) {
        if (value == null || value.trim().isEmpty()) {
            return fallback;
        }
        return value;
    }

    public static void showLocalNotification(Context context, String title, String body) {
        showNotification(context, title, body);
    }

    private static void showNotification(Context context, String title, String body) {
        createNotificationChannel(context);

        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        int pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingIntentFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                pendingIntentFlags
        );

        Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_staff_call_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setAutoCancel(true)
                .setSound(soundUri)
                .setVibrate(new long[]{0, 350, 180, 350})
                .setContentIntent(pendingIntent);

        NotificationManager notificationManager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        notificationManager.notify((int) System.currentTimeMillis(), builder.build());
    }

    private static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager notificationManager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Staff calls",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Notifications when customers call staff.");
        channel.enableVibration(true);
        channel.setSound(soundUri, audioAttributes);

        notificationManager.createNotificationChannel(channel);
    }
}
