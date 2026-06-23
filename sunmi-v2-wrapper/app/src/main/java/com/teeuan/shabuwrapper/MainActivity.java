package com.teeuan.shabuwrapper;

import android.content.Context;
import android.content.DialogInterface;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private WebView myWebView;
    private SunmiQrPrinterManager printerManager;
    private String serverUrl;
    private SharedPreferences sharedPref;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        myWebView = new WebView(this);
        setContentView(myWebView);

        sharedPref = getSharedPreferences("TeeUanPrefs", Context.MODE_PRIVATE);
        serverUrl = sharedPref.getString("server_url", "http://10.0.2.2:3000/cashier");
        printerManager = new SunmiQrPrinterManager(this);

        setupWebView();

        if (sharedPref.getBoolean("first_launch", true)) {
            showUrlConfigDialog();
            sharedPref.edit().putBoolean("first_launch", false).apply();
        } else {
            myWebView.loadUrl(serverUrl);
        }
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

        SunmiPrinterBridge bridge = new SunmiPrinterBridge(this, printerManager);
        myWebView.addJavascriptInterface(bridge, "AndroidPrintInterface");
        myWebView.addJavascriptInterface(bridge, "AndroidPrinter");

        myWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }
        });
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        menu.add(0, 1, 0, "ตั้งค่า Server URL");
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == 1) {
            showUrlConfigDialog();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    private void showUrlConfigDialog() {
        final EditText input = new EditText(this);
        input.setText(serverUrl);
        input.setHint("http://192.168.1.50:3000/cashier");

        new AlertDialog.Builder(this)
                .setTitle("ตั้งค่า Server URL")
                .setMessage("กรอก URL หน้าแคชเชียร์ของระบบ")
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
            myWebView.destroy();
        }
        super.onDestroy();
    }
}
