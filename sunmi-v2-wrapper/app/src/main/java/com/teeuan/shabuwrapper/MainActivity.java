package com.teeuan.shabuwrapper;

import android.Manifest;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.DialogInterface;
import android.content.pm.PackageManager;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.Menu;
import android.view.MenuItem;
import android.view.ViewGroup;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends AppCompatActivity {
    private static final String DEFAULT_SERVER_URL = "https://teeauansuki-app.vercel.app/login";
    private static final String DEFAULT_ORDER_BASE_URL = "https://teeauansuki-app.vercel.app";
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 112;

    private WebView myWebView;
    private SunmiQrPrinterManager printerManager;
    private String serverUrl;
    private SharedPreferences sharedPref;
    private boolean offlineAuthenticated = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        myWebView = new WebView(this);
        FrameLayout rootLayout = new FrameLayout(this);
        rootLayout.addView(
                myWebView,
                new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                )
        );

        Button fcmTokenButton = new Button(this);
        fcmTokenButton.setText("FCM");
        fcmTokenButton.setTextSize(12);
        fcmTokenButton.setAlpha(0.82f);
        fcmTokenButton.setOnClickListener(view -> showFcmTokenDialog());

        int buttonSize = dpToPx(56);
        FrameLayout.LayoutParams buttonParams = new FrameLayout.LayoutParams(buttonSize, buttonSize);
        buttonParams.gravity = Gravity.TOP | Gravity.END;
        buttonParams.setMargins(0, dpToPx(12), dpToPx(12), 0);
        rootLayout.addView(fcmTokenButton, buttonParams);
        setContentView(rootLayout);

        sharedPref = getSharedPreferences("TeeUanPrefs", Context.MODE_PRIVATE);
        serverUrl = sharedPref.getString("server_url", DEFAULT_SERVER_URL);
        printerManager = new SunmiQrPrinterManager(this);

        setupWebView();
        requestNotificationPermissionIfNeeded();
        refreshFcmToken();
        myWebView.loadUrl(serverUrl);
    }

    private int dpToPx(int dp) {
        return Math.round(dp * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (printerManager != null) {
            printerManager.bind();
        }
    }

    @Override
    protected void onStop() {
        if (printerManager != null) {
            printerManager.unbind();
        }
        super.onStop();
    }

    private void setupWebView() {
        WebSettings webSettings = myWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setUseWideViewPort(true);
        webSettings.setSupportZoom(false);
        webSettings.setBuiltInZoomControls(false);
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
        webSettings.setMediaPlaybackRequiresUserGesture(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            webSettings.setOffscreenPreRaster(true);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webSettings.setSafeBrowsingEnabled(true);
        }

        SunmiPrinterBridge bridge = new SunmiPrinterBridge(this, printerManager);
        myWebView.addJavascriptInterface(bridge, "AndroidPrintInterface");
        myWebView.addJavascriptInterface(bridge, "AndroidPrinter");

        myWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                if (failingUrl != null && failingUrl.equals(serverUrl)) {
                    showOfflineLoginPage("โหลดระบบออนไลน์ไม่ได้ กรุณาเข้าใช้งานโหมดออฟไลน์");
                }
            }
        });

        myWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onJsAlert(WebView view, String url, String message, final JsResult result) {
                if (isFinishing() || isDestroyed()) {
                    result.cancel();
                    return true;
                }

                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message == null ? "" : message)
                        .setCancelable(true)
                        .setPositiveButton(android.R.string.ok, new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface dialog, int which) {
                                result.confirm();
                            }
                        })
                        .setOnCancelListener(dialog -> result.cancel())
                        .show();
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {
                if (isFinishing() || isDestroyed()) {
                    result.cancel();
                    return true;
                }

                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message == null ? "" : message)
                        .setCancelable(true)
                        .setPositiveButton(android.R.string.ok, new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface dialog, int which) {
                                result.confirm();
                            }
                        })
                        .setNegativeButton(android.R.string.cancel, new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface dialog, int which) {
                                result.cancel();
                            }
                        })
                        .setOnCancelListener(dialog -> result.cancel())
                        .show();
                return true;
            }
        });
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        menu.add(0, 2, 0, "พิมพ์ QR ออฟไลน์");
        menu.add(0, 3, 1, "แสดง FCM Token");
        menu.add(0, 1, 2, "ตั้งค่า Server URL");
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == 1) {
            showUrlConfigDialog();
            return true;
        }
        if (item.getItemId() == 2) {
            if (offlineAuthenticated) {
                showOfflineQrPage("");
            } else {
                showOfflineLoginPage("");
            }
            return true;
        }
        if (item.getItemId() == 3) {
            showFcmTokenDialog();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return;
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            return;
        }
        ActivityCompat.requestPermissions(
                this,
                new String[]{Manifest.permission.POST_NOTIFICATIONS},
                NOTIFICATION_PERMISSION_REQUEST_CODE
        );
    }

    private void refreshFcmToken() {
        FirebaseMessaging.getInstance().getToken()
                .addOnCompleteListener(task -> {
                    if (!task.isSuccessful() || task.getResult() == null) {
                        return;
                    }
                    sharedPref.edit()
                            .putString(TeeUanMessagingService.PREF_FCM_TOKEN, task.getResult())
                            .apply();
                    TeeUanMessagingService.registerToken(this, task.getResult());
                });
    }

    private void showFcmTokenDialog() {
        String token = sharedPref.getString(TeeUanMessagingService.PREF_FCM_TOKEN, "");
        if (token == null || token.trim().isEmpty()) {
            refreshFcmToken();
            token = "ยังไม่มี token กรุณาเปิดเน็ตแล้วลองใหม่อีกครั้ง";
        }

        final String tokenToCopy = token;
        new AlertDialog.Builder(this)
                .setTitle("FCM Token")
                .setMessage(token)
                .setPositiveButton("คัดลอก", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                        if (clipboard != null) {
                            clipboard.setPrimaryClip(ClipData.newPlainText("FCM Token", tokenToCopy));
                            Toast.makeText(MainActivity.this, "คัดลอก FCM Token แล้ว", Toast.LENGTH_SHORT).show();
                        }
                    }
                })
                .setNeutralButton("ทดสอบแจ้งเตือน", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        TeeUanMessagingService.showLocalNotification(
                                MainActivity.this,
                                "ทดสอบแจ้งเตือน",
                                "ถ้าเห็นข้อความนี้ แปลว่า notification ในเครื่องทำงาน"
                        );
                    }
                })
                .setNegativeButton(android.R.string.cancel, null)
                .show();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "เปิดการแจ้งเตือนแล้ว", Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void showUrlConfigDialog() {
        final EditText input = new EditText(this);
        input.setText(serverUrl);
        input.setHint(DEFAULT_SERVER_URL);

        new AlertDialog.Builder(this)
                .setTitle("ตั้งค่า Server URL")
                .setMessage("กรอก URL หน้าเข้าสู่ระบบ")
                .setView(input)
                .setPositiveButton("บันทึกและโหลดใหม่", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        String newUrl = input.getText().toString().trim();
                        if (!newUrl.isEmpty()) {
                            serverUrl = newUrl;
                            sharedPref.edit().putString("server_url", serverUrl).apply();
                            myWebView.loadUrl(serverUrl);
                        }
                    }
                })
                .setNegativeButton("ยกเลิก", null)
                .show();
    }

    public String getOrderBaseUrl() {
        try {
            Uri uri = Uri.parse(serverUrl);
            if (uri.getScheme() == null || uri.getHost() == null) {
                return DEFAULT_ORDER_BASE_URL;
            }
            Uri.Builder builder = new Uri.Builder()
                    .scheme(uri.getScheme())
                    .encodedAuthority(uri.getEncodedAuthority());
            return builder.build().toString();
        } catch (Exception error) {
            return DEFAULT_ORDER_BASE_URL;
        }
    }

    private void showOfflineLoginPage(String notice) {
        String safeNotice = notice == null ? "" : notice;

        myWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && url.startsWith("offline-qr://open")) {
                    showOfflineQrPage("");
                    return true;
                }
                view.loadUrl(url);
                return true;
            }
        });
        myWebView.loadUrl("file:///android_asset/offline-login.html?notice=" + Uri.encode(safeNotice));
    }

    private void showOfflineQrPage(String notice) {
        myWebView.loadUrl("file:///android_asset/offline-qr.html");
    }

    public boolean validateOfflinePin(String pin) {
        boolean ok = "111111".equals(pin) || "999999".equals(pin);
        if (ok) {
            offlineAuthenticated = true;
        }
        return ok;
    }

    @Override
    public void onBackPressed() {
        if (myWebView.canGoBack()) {
            myWebView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (myWebView != null) {
            myWebView.removeJavascriptInterface("AndroidPrintInterface");
            myWebView.removeJavascriptInterface("AndroidPrinter");
            myWebView.stopLoading();
            myWebView.loadUrl("about:blank");
            myWebView.setWebChromeClient(null);
            myWebView.destroy();
        }
        super.onDestroy();
    }
}
